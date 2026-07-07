/**
 * Reconcile a single tournament entry that landed on-chain but is missing in
 * the DB (buyTicket succeeded, server verify never recorded it → the player is
 * stuck re-buying and the contract reverts `AlreadyHasTicket()`).
 *
 * It reuses the production verified path (`enterTournamentOnChain` →
 * `recordPaidEntry`), which is idempotent on `[gameId, userId]` and `txHash`,
 * so running it twice is a no-op.
 *
 * Requires `.env.production` (same as the other one-off scripts) so it talks to
 * the real prod DB + RPC.
 *
 *   RECONCILE_WALLET=0x...            (required) buyer wallet
 *   RECONCILE_GAME_ONCHAIN_ID=0x...   (either this…)
 *   RECONCILE_GAME_NUMBER=234         (…or this)
 *   DRY_RUN=1                         (optional) report only, no write
 *
 * Run: node --import tsx scripts/reconcile-tournament-entry.ts
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

const ENV_FILE = ".env.production";
if (!existsSync(ENV_FILE)) {
  throw new Error(`${ENV_FILE} is required for this script (prod DB + RPC).`);
}
loadEnvFile(ENV_FILE);

const { getAddress, parseAbiItem } = await import("viem");
const { prisma } = await import("@/lib/db");
const { getPublicClient } = await import("@/lib/chain");
const { getWaffleContractAddress } = await import("@/lib/chain/config");
const { enterTournamentOnChain } = await import("@/lib/player/tournamentGames");

const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const walletRaw = process.env.RECONCILE_WALLET;
if (!walletRaw) throw new Error("RECONCILE_WALLET is required");
const wallet = getAddress(walletRaw);

const onchainId = process.env.RECONCILE_GAME_ONCHAIN_ID?.trim();
const gameNumberRaw = process.env.RECONCILE_GAME_NUMBER?.trim();
if (!onchainId && !gameNumberRaw) {
  throw new Error("Provide RECONCILE_GAME_ONCHAIN_ID or RECONCILE_GAME_NUMBER");
}

async function main() {
  // 1. Resolve the game.
  const game = await prisma.game.findFirst({
    where: onchainId
      ? { onchainId }
      : { gameNumber: Number(gameNumberRaw) },
    select: {
      id: true,
      gameNumber: true,
      platform: true,
      network: true,
      onchainId: true,
      endsAt: true,
      rankedAt: true,
    },
  });
  if (!game) throw new Error("Game not found in DB");
  if (!game.onchainId) throw new Error(`Game ${game.id} has no onchainId`);

  // 2. Resolve the user (single wallet or linked UserWallet).
  const user =
    (await prisma.user.findFirst({
      where: { wallet: { equals: wallet, mode: "insensitive" } },
      select: { id: true, username: true, platform: true },
    })) ??
    (await prisma.userWallet
      .findFirst({
        where: { wallet: { equals: wallet, mode: "insensitive" } },
        select: { user: { select: { id: true, username: true, platform: true } } },
      })
      .then((r) => r?.user ?? null));
  if (!user) throw new Error(`No user found for wallet ${wallet}`);

  // 3. Already recorded? Idempotent short-circuit.
  const existing = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId: game.id, userId: user.id } },
    select: { id: true, txHash: true, paidAt: true },
  });
  if (existing) {
    console.log("✓ Entry already exists — nothing to do:", existing);
    return;
  }

  // 4. Find the on-chain purchase tx (both fields indexed → cheap filter).
  const chainTarget = { platform: game.platform, network: game.network };
  const contractAddress = getWaffleContractAddress(chainTarget);
  const client = getPublicClient(chainTarget);
  const logs = await client.getLogs({
    address: contractAddress,
    event: parseAbiItem(
      "event TicketPurchased(bytes32 indexed gameId, address indexed player, uint256 amount)",
    ),
    args: { gameId: game.onchainId as `0x${string}`, player: wallet },
    fromBlock: "earliest",
    toBlock: "latest",
  });
  if (logs.length === 0) {
    throw new Error(
      `No TicketPurchased log for ${wallet} on game ${game.onchainId} @ ${contractAddress}. ` +
        `Did the purchase actually land on this contract/network?`,
    );
  }
  const txHash = logs[logs.length - 1].transactionHash;

  console.log("Reconcile plan:", {
    game: `#${game.gameNumber} (${game.id})`,
    platform: game.platform,
    network: game.network,
    user: `${user.username ?? "?"} (${user.id})`,
    wallet,
    txHash,
    dryRun: DRY_RUN,
  });
  if (DRY_RUN) {
    console.log("DRY_RUN — not writing. Re-run without DRY_RUN=1 to record.");
    return;
  }

  // 5. Record via the exact production verified + idempotent path.
  const res = await enterTournamentOnChain({
    userId: user.id,
    gameId: game.id,
    txHash,
    wallet,
  });
  console.log("Result:", res);
  if (!res.ok) throw new Error(`Reconcile failed: ${res.error}`);
  console.log(res.alreadyEntered ? "✓ Was already entered." : "✓ Entry recorded.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
