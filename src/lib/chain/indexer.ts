/**
 * On-chain event indexer — projects `TicketPurchased` logs into GameEntry rows.
 *
 * The client happy-path (`enterTournament(gameId, txHash)`) still records an
 * entry the instant a purchase confirms. This indexer is the backstop: if the
 * client dies before reporting back, the purchase is still on-chain, so we tail
 * the contract's own event log and record any entry the fast-path missed. The
 * DB becomes a projection of chain state rather than a client-reported mirror,
 * which makes the "paid on-chain but no DB entry" desync structurally
 * impossible (it self-heals within one poll interval).
 *
 * Safety model:
 *  - We never process within `CONFIRMATIONS` blocks of the head (reorg safety).
 *  - Each run re-scans a small `REORG_OVERLAP` window below the cursor; combined
 *    with idempotent projection, that self-heals any shallow reorg for free.
 *  - Projection is idempotent: GameEntry is unique on [gameId,userId] and txHash,
 *    and we skip logs whose txHash is already recorded, so re-runs are no-ops.
 */
import { prisma } from "@/lib/db";
import { normalizeAddress } from "@/lib/auth";
import { getPublicClient } from "@/lib/chain/client";
import { getWaffleContractAddress } from "@/lib/chain/config";
import type { GameNetwork } from "@/lib/chain/network";
import type { ChainPlatform } from "@/lib/chain/platform";
import {
  scanTicketPurchasedLogs,
  type IndexTarget,
  type TicketPurchasedLog,
} from "@/lib/chain/ticketLogs";
import { enterTournamentOnChain } from "@/lib/player/tournamentGames";

export type { IndexTarget } from "@/lib/chain/ticketLogs";
export { scanTicketPurchasedLogs } from "@/lib/chain/ticketLogs";

/** Stay this many blocks behind the chain head — a log within this window could
 *  still be reorged out. Celo reorgs are shallow, so a small lag suffices. */
const CONFIRMATIONS = 6n;
/** Re-scan this many blocks below the cursor each run. Idempotent projection
 *  makes the overlap free and self-heals a shallow reorg near the tail. */
const REORG_OVERLAP = 12n;

type ProjectOutcome = "recorded" | "exists" | "no_game" | "no_user" | "failed" | "skipped";

let indexerRunning = false;

function chainKey(target: IndexTarget): string {
  return `${target.platform}:${target.network}`;
}

/** Every (platform, network) that has at least one on-chain game — derived from
 *  the games themselves so the indexer self-adapts to whatever chains are live. */
export async function getIndexableTargets(): Promise<IndexTarget[]> {
  const rows = await prisma.game.findMany({
    where: { onchainId: { not: null } },
    distinct: ["platform", "network"],
    select: { platform: true, network: true },
  });
  return rows.map((r) => ({
    platform: r.platform as ChainPlatform,
    network: r.network as GameNetwork,
  }));
}

/** Record one `TicketPurchased` log as a GameEntry, reusing the exact production
 *  verify+record path. Idempotent and safe to call on already-recorded logs. */
export async function projectTicketPurchase(log: TicketPurchasedLog): Promise<ProjectOutcome> {
  const txHash = log.transactionHash;
  const onchainId = log.args.gameId;
  const player = log.args.player;
  if (!txHash || !onchainId || !player) return "skipped";

  // Fast-path: already recorded (by the client callback or a prior scan). Skip
  // before any RPC re-verification so re-scans stay cheap.
  const existing = await prisma.gameEntry.findUnique({
    where: { txHash },
    select: { id: true },
  });
  if (existing) return "exists";

  const game = await prisma.game.findUnique({
    where: { onchainId },
    select: { id: true },
  });
  if (!game) return "no_game";

  const wallet = normalizeAddress(player);
  const directUser = await prisma.user.findFirst({
    where: { wallet: { equals: wallet, mode: "insensitive" } },
    select: { id: true },
  });
  const linked = directUser
    ? null
    : await prisma.userWallet.findFirst({
        where: { wallet: { equals: wallet, mode: "insensitive" } },
        select: { userId: true },
      });
  const userId = directUser?.id ?? linked?.userId;
  if (!userId) {
    // Purchase from a wallet no account is linked to yet — can't create an entry
    // without a user. Rare (buyers are logged in); resolves if they later link.
    console.warn(`[Indexer] Unresolved wallet ${wallet} for tx ${txHash} — skipping`);
    return "no_user";
  }

  const res = await enterTournamentOnChain({ userId, gameId: game.id, txHash, wallet });
  if (!res.ok) {
    console.error(`[Indexer] Record failed for tx ${txHash} (game ${game.id}):`, res.error);
    return "failed";
  }
  if (res.alreadyEntered) return "exists";
  console.log(`[Indexer] Projected tx ${txHash} → entry (game ${game.id}, user ${userId})`);
  return "recorded";
}

/** Tail one chain: advance its cursor from the last processed block to a fresh
 *  reorg-safe head, projecting any TicketPurchased logs in between. */
async function indexTarget(target: IndexTarget): Promise<void> {
  const key = chainKey(target);
  const contract = getWaffleContractAddress(target);
  const client = getPublicClient(target);

  const head = await client.getBlockNumber();
  const safeHead = head - CONFIRMATIONS;
  if (safeHead <= 0n) return;

  const cursor = await prisma.chainIndexerCursor.findUnique({ where: { chainKey: key } });
  if (!cursor) {
    // First sight of this chain: start tailing from the current safe head.
    // Historical purchases are swept up separately by the backfill script.
    await prisma.chainIndexerCursor.create({
      data: { chainKey: key, contract, lastBlock: safeHead },
    });
    console.log(`[Indexer] ${key}: initialized cursor at block ${safeHead}`);
    return;
  }

  const overlapStart = cursor.lastBlock + 1n - REORG_OVERLAP;
  const fromBlock = overlapStart > 0n ? overlapStart : 0n;
  const toBlock = safeHead;
  if (toBlock < fromBlock) return; // nothing new past the confirmation window

  const logs = await scanTicketPurchasedLogs(target, fromBlock, toBlock);
  let recorded = 0;
  for (const log of logs) {
    const outcome = await projectTicketPurchase(log);
    if (outcome === "recorded") recorded++;
  }

  await prisma.chainIndexerCursor.update({
    where: { chainKey: key },
    data: { lastBlock: toBlock, contract },
  });

  if (logs.length > 0) {
    console.log(
      `[Indexer] ${key}: blocks ${fromBlock}-${toBlock}, ${logs.length} log(s), ${recorded} new entry(ies)`,
    );
  }
}

/** Run one indexer pass across every live chain. Guarded against overlap and
 *  isolated per-target so one bad RPC doesn't stall the others. Never throws. */
export async function runTicketIndexer(source: string): Promise<void> {
  if (indexerRunning) {
    console.log("[Indexer] Skipped: previous run still active");
    return;
  }
  indexerRunning = true;
  try {
    const targets = await getIndexableTargets();
    for (const target of targets) {
      try {
        await indexTarget(target);
      } catch (error) {
        console.error(`[Indexer] ${chainKey(target)} failed (${source}):`, error);
      }
    }
  } catch (error) {
    console.error(`[Indexer] Run failed (${source}):`, error);
  } finally {
    indexerRunning = false;
  }
}
