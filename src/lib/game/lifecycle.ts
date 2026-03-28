/**
 * Game Lifecycle Service
 *
 * Core functions for ranking games and publishing results on-chain.
 * Used by cron job for automatic processing.
 */

import { parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { getPublicClient, getSettlerWalletClient } from "@/lib/chain/client";
import { withBuilderCodeDataSuffix } from "@/lib/chain/builderCode";
import {
  buildMerkleTree,
  generateAllProofs,
  type Winner,
} from "@/lib/chain/merkle";
import { waffleGameAbi } from "@/lib/chain/abi";
import { sendToUser, sendBatch } from "@/lib/notifications";
import { env } from "@/lib/env";
import {
  calculatePrizeDistribution,
  formatDistribution,
  WINNERS_COUNT,
  type PlayerEntry,
} from "./prizeDistribution";
import { PAYMENT_TOKEN_DECIMALS, getWaffleContractAddress } from "../chain";

// ============================================================================
// Types
// ============================================================================

export interface RankResult {
  success: boolean;
  entriesRanked: number;
  prizesDistributed: number;
  prizePool: number;
  winners: Array<{
    rank: number;
    prize: number;
    userId: string;
    username: string;
  }>;
}

export interface PublishResult {
  success: boolean;
  merkleRoot: string;
  txHash: string;
  winnersCount: number;
}

// ============================================================================
// Rank Game
// ============================================================================

/**
 * Calculate rankings and distribute prizes. Idempotent.
 */
export async function rankGame(gameId: string): Promise<RankResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, endsAt: true, rankedAt: true, prizePool: true },
  });

  if (!game) throw new Error(`Game ${gameId} not found`);

  // Already ranked - return existing data
  if (game.rankedAt) {
    const existingWinners = await prisma.gameEntry.findMany({
      where: { gameId, prize: { gt: 0 } },
      select: {
        rank: true,
        prize: true,
        userId: true,
        user: { select: { username: true } },
      },
      orderBy: { rank: "asc" },
    });

    return {
      success: true,
      entriesRanked: await prisma.gameEntry.count({
        where: { gameId, rank: { not: null } },
      }),
      prizesDistributed: existingWinners.length,
      prizePool: game.prizePool,
      winners: existingWinners.map((w) => ({
        rank: w.rank!,
        prize: w.prize ?? 0,
        userId: w.userId,
        username: w.user.username ?? "Unknown",
      })),
    };
  }

  if (new Date() < game.endsAt)
    throw new Error(`Game ${gameId} has not ended yet`);

  // Get all entries ordered by score (tie-breaker: earlier submission wins)
  const entries = await prisma.gameEntry.findMany({
    where: { gameId },
    orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
    select: {
      id: true,
      score: true,
      userId: true,
      paidAmount: true,
      paidAt: true,
      purchaseSource: true,
      user: { select: { username: true } },
    },
  });

  // Handle no entries case
  if (entries.length === 0) {
    await prisma.game.update({
      where: { id: gameId },
      data: { rankedAt: new Date() },
    });
    return {
      success: true,
      entriesRanked: 0,
      prizesDistributed: 0,
      prizePool: game.prizePool,
      winners: [],
    };
  }

  // Transform entries for prize distribution algorithm
  const playerEntries: PlayerEntry[] = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    score: e.score,
    paidAmount:
      e.purchaseSource === "FREE_ADMIN" || e.purchaseSource === "FREE_PLAYER"
        ? 0
        : e.paidAt ? (e.paidAmount ?? 0) : 0,
    username: e.user.username ?? undefined,
  }));

  // Calculate prize distribution using new algorithm
  const distribution = calculatePrizeDistribution(
    playerEntries,
    game.prizePool,
  );

  // Log distribution for debugging
  console.log(`[Lifecycle] ${formatDistribution(distribution)}`);

  // Build update data and winners list
  const winners: Array<{
    rank: number;
    prize: number;
    userId: string;
    username: string;
    entryId: string;
  }> = [];

  const updateData = distribution.allocations.map((alloc) => {
    if (alloc.prize > 0) {
      winners.push({
        rank: alloc.rank,
        prize: alloc.prize,
        userId: alloc.userId,
        username: alloc.username ?? "Unknown",
        entryId: alloc.entryId,
      });
    }
    return {
      id: alloc.entryId,
      rank: alloc.rank,
      prize: alloc.prize,
    };
  });

  // Batch update
  await prisma.$transaction(async (tx) => {
    for (const data of updateData) {
      await tx.gameEntry.update({
        where: { id: data.id },
        data: { rank: data.rank, prize: data.prize > 0 ? data.prize : null },
      });
    }
    await tx.game.update({
      where: { id: gameId },
      data: { rankedAt: new Date() },
    });
  });

  console.log(
    `[Lifecycle] Ranked ${entries.length} entries, ${winners.length} winners`,
  );

  return {
    success: true,
    entriesRanked: entries.length,
    prizesDistributed: winners.length,
    prizePool: game.prizePool,
    winners: winners.map((w) => ({
      rank: w.rank,
      prize: w.prize,
      userId: w.userId,
      username: w.username,
    })),
  };
}

// ============================================================================
// Publish Results On-Chain
// ============================================================================

/**
 * Submit merkle root to smart contract and notify players. Idempotent.
 */
export async function publishResults(gameId: string): Promise<PublishResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      onchainId: true,
      platform: true,
      rankedAt: true,
      onChainAt: true,
      prizePool: true,
      merkleRoot: true,
      onChainTxHash: true,
    },
  });

  if (!game) throw new Error(`Game ${gameId} not found`);
  if (!game.rankedAt)
    throw new Error(`Game ${gameId} must be ranked before publishing`);
  if (!game.onchainId) throw new Error(`Game ${gameId} has no on-chain ID`);

  // Already published — return cached result
  if (game.onChainAt) {
    return {
      success: true,
      merkleRoot: game.merkleRoot!,
      txHash: game.onChainTxHash!,
      winnersCount: await prisma.gameEntry.count({
        where: { gameId, prize: { gt: 0 } },
      }),
    };
  }

  const onchainId = game.onchainId as `0x${string}`;
  const contractAddress = getWaffleContractAddress(game.platform);

  // Get winners with wallets
  const rankedEntries = await prisma.gameEntry.findMany({
    where: {
      gameId,
      prize: { gt: 0 },
      paidAt: { not: null },
    },
    include: { user: { select: { wallet: true } } },
    orderBy: { rank: "asc" },
  });

  if (rankedEntries.length === 0)
    throw new Error(`No winners to publish for game ${gameId}`);

  // Build merkle tree
  const winners: Winner[] = rankedEntries
    .filter((e) => e.payerWallet || e.user.wallet)
    .map((entry) => ({
      gameId: onchainId,
      address: (entry.payerWallet || entry.user.wallet) as `0x${string}`,
      amount: parseUnits((entry.prize ?? 0).toFixed(6), PAYMENT_TOKEN_DECIMALS),
    }));

  if (winners.length === 0)
    throw new Error(`No winners with wallets for game ${gameId}`);

  const { root: merkleRoot } = buildMerkleTree(winners);
  const allProofs = generateAllProofs(winners);

  // Submit to chain
  const publicClient = getPublicClient(game.platform);
  const walletClient = getSettlerWalletClient(game.platform);
  const txHash = await walletClient.writeContract(
    withBuilderCodeDataSuffix({
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "submitResults",
      args: [onchainId, merkleRoot],
    }),
  );

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Update database
  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: { merkleRoot, onChainTxHash: txHash, onChainAt: new Date() },
    });

    for (const entry of rankedEntries) {
      const addr = (entry.payerWallet || entry.user.wallet)?.toLowerCase();
      const proofData = addr ? allProofs.get(addr) : null;
      if (proofData) {
        await tx.gameEntry.update({
          where: { id: entry.id },
          data: {
            merkleProof: proofData.proof,
            merkleAmount: proofData.amount.toString(),
          },
        });
      }
    }
  });

  console.log(`[Lifecycle] Published on-chain. TX: ${txHash}`);

  // Send notifications async
  sendResultNotifications(gameId).catch((err) =>
    console.error("[Lifecycle] Notification error:", err),
  );

  return { success: true, merkleRoot, txHash, winnersCount: winners.length };
}

// ============================================================================
// Notifications
// ============================================================================

export async function sendResultNotifications(gameId: string) {
  // Get game info for templates
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { gameNumber: true },
  });

  if (!game) {
    console.error("[Lifecycle] Game not found for notifications:", gameId);
    return;
  }

  const allEntries = await prisma.gameEntry.findMany({
    where: { gameId, user: { hasGameAccess: true, isBanned: false } },
    select: {
      userId: true,
      rank: true,
      prize: true,
    },
  });

  const winners = allEntries.filter(
    (e) => (e.prize ?? 0) > 0,
  );
  const nonWinners = allEntries.filter(
    (e) => (e.prize ?? 0) <= 0,
  );

  // Import templates dynamically to avoid circular deps
  const { postGame, buildPayload } =
    await import("@/lib/notifications/templates");

  // Winners: personalized with rank
  await Promise.allSettled(
    winners.map((entry) => {
      const template = postGame.winner(game.gameNumber, entry.rank!);
      const payload = buildPayload(template, gameId, "result");
      return sendToUser(entry.userId, payload);
    }),
  );

  // Non-winners: batch notification
  if (nonWinners.length > 0) {
    const template = postGame.results(game.gameNumber);
    const payload = buildPayload(template, gameId, "result");
    await sendBatch(payload, nonWinners.map((e) => e.userId));
  }

  console.log(
    `[Lifecycle] Sent notifications: ${winners.length} winners, ${nonWinners.length} non-winners`,
  );
}
