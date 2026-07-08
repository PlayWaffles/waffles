/**
 * Low-level reads of the contract's `TicketPurchased` event log. Kept free of
 * any player/DB imports so both the indexer (src/lib/chain/indexer.ts) and the
 * player entry path (tournamentGames.ts) can use it without a circular import.
 */
import { parseAbiItem } from "viem";
import { getPublicClient } from "@/lib/chain/client";
import { getWaffleContractAddress } from "@/lib/chain/config";
import type { GameNetwork } from "@/lib/chain/network";
import type { ChainPlatform } from "@/lib/chain/platform";

export const TICKET_PURCHASED_EVENT = parseAbiItem(
  "event TicketPurchased(bytes32 indexed gameId, address indexed player, uint256 amount)",
);

/** `eth_getLogs` chunk size we *try* first. On RPCs that cap the range (e.g.
 *  Alchemy's free tier = 10 blocks) `getLogsChunked` auto-shrinks per response. */
const DEFAULT_BLOCK_RANGE = 5_000n;
/** Floor for adaptive shrinking. */
const MIN_BLOCK_RANGE = 10n;

export type IndexTarget = { platform: ChainPlatform; network: GameNetwork };

/** One decoded `TicketPurchased` log, with typed `args` (gameId, player, amount). */
async function getPurchaseLogs(
  target: IndexTarget,
  fromBlock: bigint,
  toBlock: bigint,
  extraArgs?: { gameId?: `0x${string}`; player?: `0x${string}` },
) {
  return getPublicClient(target).getLogs({
    address: getWaffleContractAddress(target),
    event: TICKET_PURCHASED_EVENT,
    ...(extraArgs ? { args: extraArgs } : {}),
    fromBlock,
    toBlock,
  });
}
export type TicketPurchasedLog = Awaited<ReturnType<typeof getPurchaseLogs>>[number];

/** True if an RPC error is a "block range too large" complaint (provider-agnostic). */
function isBlockRangeError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("block range") ||
    msg.includes("range should work") ||
    msg.includes("up to a") ||
    msg.includes("query returned more than") ||
    msg.includes("logs matched")
  );
}

/** Some providers state the allowed span ("up to a 10 block range") — use it to
 *  shrink to the right size in one step instead of blindly halving. */
function suggestedRange(error: unknown): bigint | null {
  const msg = error instanceof Error ? error.message : String(error);
  const m = msg.match(/up to a?\s*(\d+)\s*block range/i);
  return m ? BigInt(m[1]) : null;
}

/** Fetch logs over [fromBlock, toBlock], chunked and adaptively shrinking the
 *  window whenever an RPC rejects the range — so the same code works on a
 *  permissive RPC (few big requests) and a capped one (many small requests). */
async function getLogsChunked(
  target: IndexTarget,
  fromBlock: bigint,
  toBlock: bigint,
  args?: { gameId?: `0x${string}`; player?: `0x${string}` },
): Promise<TicketPurchasedLog[]> {
  const out: TicketPurchasedLog[] = [];
  let start = fromBlock;
  let span = DEFAULT_BLOCK_RANGE;
  while (start <= toBlock) {
    const end = start + span - 1n > toBlock ? toBlock : start + span - 1n;
    try {
      out.push(...(await getPurchaseLogs(target, start, end, args)));
      start = end + 1n;
    } catch (error) {
      if (isBlockRangeError(error) && span > MIN_BLOCK_RANGE) {
        const hinted = suggestedRange(error);
        span = hinted && hinted >= 1n ? hinted : span / 2n > MIN_BLOCK_RANGE ? span / 2n : MIN_BLOCK_RANGE;
        continue; // retry the same start with a smaller window
      }
      throw error;
    }
  }
  return out;
}

/** Fetch `TicketPurchased` logs for a target over [fromBlock, toBlock]. */
export async function scanTicketPurchasedLogs(
  target: IndexTarget,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<TicketPurchasedLog[]> {
  return getLogsChunked(target, fromBlock, toBlock, undefined);
}

/** Find the tx hash of a specific wallet's `TicketPurchased` for one game, using
 *  the two indexed topics (gameId + player). Returns the most recent match, or
 *  null if the wallet never bought on this contract (or the range scan failed on
 *  a capped RPC — in which case the indexer backstop still records the entry). */
export async function findTicketPurchaseTx(
  target: IndexTarget,
  onchainId: `0x${string}`,
  wallet: `0x${string}`,
): Promise<`0x${string}` | null> {
  const head = await getPublicClient(target).getBlockNumber();
  try {
    const logs = await getLogsChunked(target, 0n, head, { gameId: onchainId, player: wallet });
    return logs[logs.length - 1]?.transactionHash ?? null;
  } catch (error) {
    console.warn("[buy-ticket] findTicketPurchaseTx range scan failed:", error);
    return null;
  }
}
