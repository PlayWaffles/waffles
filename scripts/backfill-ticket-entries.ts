/**
 * One-shot historical backfill for the ticket indexer.
 *
 * The live indexer (src/lib/chain/indexer.ts) only tails NEW blocks. This script
 * sweeps a historical range for `TicketPurchased` logs and projects any that are
 * missing a DB entry — clearing users who paid on-chain but were never recorded
 * (the "stuck, re-buying, AlreadyHasTicket" case). Same idempotent projection as
 * the live indexer, so it is safe to run (and re-run) at will.
 *
 * Requires `.env.production` (prod DB + RPC), like the other one-off scripts.
 *
 *   BACKFILL_FROM_BLOCK=12345678     (required) block to scan from (contract deploy block is ideal)
 *   BACKFILL_PLATFORM=MINIPAY        (optional) limit to one platform; default: all live chains
 *   BACKFILL_NETWORK=CELO_MAINNET    (optional) limit to one network
 *   DRY_RUN=1                        (optional) report what WOULD be projected, write nothing
 *
 * Run: node --import tsx scripts/backfill-ticket-entries.ts
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const ENV_FILE = ".env.production";
if (!existsSync(ENV_FILE)) {
  throw new Error(`${ENV_FILE} is required for this script (prod DB + RPC).`);
}
loadEnvFile(ENV_FILE);

const { getPublicClient } = await import("@/lib/chain/client");
const { getWaffleContractAddress } = await import("@/lib/chain/config");
const { getIndexableTargets, scanTicketPurchasedLogs, projectTicketPurchase } =
  await import("@/lib/chain/indexer");
const { prisma } = await import("@/lib/db");

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const fromBlockRaw = process.env.BACKFILL_FROM_BLOCK?.trim();
if (!fromBlockRaw) throw new Error("BACKFILL_FROM_BLOCK is required");
const FROM_BLOCK = BigInt(fromBlockRaw);

const onlyPlatform = process.env.BACKFILL_PLATFORM?.trim();
const onlyNetwork = process.env.BACKFILL_NETWORK?.trim();

const CONFIRMATIONS = 6n;

async function main() {
  let targets = await getIndexableTargets();
  if (onlyPlatform) targets = targets.filter((t) => t.platform === onlyPlatform);
  if (onlyNetwork) targets = targets.filter((t) => t.network === onlyNetwork);
  if (targets.length === 0) throw new Error("No matching on-chain game targets found");

  for (const target of targets) {
    const key = `${target.platform}:${target.network}`;
    const contract = getWaffleContractAddress(target);
    const head = await getPublicClient(target).getBlockNumber();
    const toBlock = head - CONFIRMATIONS;
    if (toBlock < FROM_BLOCK) {
      console.log(`[Backfill] ${key}: head ${toBlock} < from ${FROM_BLOCK}, nothing to scan`);
      continue;
    }

    console.log(`[Backfill] ${key} @ ${contract}: scanning blocks ${FROM_BLOCK}-${toBlock}…`);
    const logs = await scanTicketPurchasedLogs(target, FROM_BLOCK, toBlock);
    console.log(`[Backfill] ${key}: ${logs.length} TicketPurchased log(s) found`);

    const counts: Record<string, number> = {};
    for (const log of logs) {
      if (DRY_RUN) {
        const existing = await prisma.gameEntry.findUnique({
          where: { txHash: log.transactionHash ?? "" },
          select: { id: true },
        });
        const outcome = existing ? "exists" : "would_record";
        counts[outcome] = (counts[outcome] ?? 0) + 1;
        if (outcome === "would_record") {
          console.log(`  would project tx ${log.transactionHash} (player ${log.args.player})`);
        }
        continue;
      }
      const outcome = await projectTicketPurchase(log);
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    }
    console.log(`[Backfill] ${key}: ${DRY_RUN ? "DRY_RUN " : ""}outcomes`, counts);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
