/**
 * Settlement pipeline — rank → merkle publish → notify.
 *
 * Each stage is a module with a narrow interface. Post-rank Syrup/mission
 * effects sit behind applyPostRankEffects(); the notify seam is always reached
 * through notifyStage(), never duplicated at call sites.
 */

import { parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { getPublicClient, getSettlerWalletClient } from "@/lib/chain/client";
import { withBuilderCodeDataSuffix } from "@/lib/chain/builderCode";
import { buildMerkleTreeWithProofs, type Winner } from "@/lib/chain/merkle";
import { waffleGameAbi } from "@/lib/chain/abi";
import { sendToUser, sendBatch } from "@/lib/notifications";
import {
  calculatePrizeDistribution,
  formatDistribution,
  type PlayerEntry,
} from "./prizeDistribution";
import { PAYMENT_TOKEN_DECIMALS, getWaffleContractAddress } from "../chain";
import { applyPostRankEffects } from "./settlement-effects";


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

export interface SettleResult {
  ranked: RankResult;
  published: boolean;
  publishResult?: PublishResult;
}

// ============================================================================
// Stage 1: Rank
// ============================================================================

export async function rankStage(gameId: string): Promise<RankResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, startsAt: true, endsAt: true, rankedAt: true, prizePool: true },
  });

  if (!game) throw new Error(`Game ${gameId} not found`);

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

  if (new Date() < game.endsAt) {
    throw new Error(`Game ${gameId} has not ended yet`);
  }

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

  const playerEntries: PlayerEntry[] = entries.map((e) => ({
    id: e.id,
    userId: e.userId,
    score: e.score,
    paidAmount:
      e.purchaseSource === "FREE_ADMIN" || e.purchaseSource === "FREE_PLAYER"
        ? 0
        : e.paidAt
          ? (e.paidAmount ?? 0)
          : 0,
    username: e.user.username ?? undefined,
  }));

  const distribution = calculatePrizeDistribution(
    playerEntries,
    game.prizePool,
  );

  console.log(`[Settlement] ${formatDistribution(distribution)}`);

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
    `[Settlement] Ranked ${entries.length} entries, ${winners.length} winners`,
  );

  await applyPostRankEffects(
    gameId,
    distribution,
    winners.map((w) => ({
      rank: w.rank,
      prize: w.prize,
      userId: w.userId,
    })),
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
// Stage 2: Publish (merkle + on-chain)
// ============================================================================

export async function publishStage(gameId: string): Promise<PublishResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      onchainId: true,
      platform: true,
      network: true,
      rankedAt: true,
      onChainAt: true,
      merkleRoot: true,
      onChainTxHash: true,
    },
  });

  if (!game) throw new Error(`Game ${gameId} not found`);
  if (!game.rankedAt) {
    throw new Error(`Game ${gameId} must be ranked before publishing`);
  }
  if (!game.onchainId) throw new Error(`Game ${gameId} has no on-chain ID`);

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
  const chainTarget = { platform: game.platform, network: game.network };
  const contractAddress = getWaffleContractAddress(chainTarget);

  const rankedEntries = await prisma.gameEntry.findMany({
    where: {
      gameId,
      prize: { gt: 0 },
      paidAt: { not: null },
    },
    include: { user: { select: { wallet: true } } },
    orderBy: { rank: "asc" },
  });

  if (rankedEntries.length === 0) {
    throw new Error(`No winners to publish for game ${gameId}`);
  }

  const winners: Winner[] = rankedEntries
    .filter((e) => e.payerWallet || e.user.wallet)
    .map((entry) => ({
      gameId: onchainId,
      address: (entry.payerWallet || entry.user.wallet) as `0x${string}`,
      amount: parseUnits(
        (entry.prize ?? 0).toFixed(6),
        PAYMENT_TOKEN_DECIMALS,
      ),
    }));

  if (winners.length === 0) {
    throw new Error(`No winners with wallets for game ${gameId}`);
  }

  const { root: merkleRoot, proofs: allProofs } =
    buildMerkleTreeWithProofs(winners);

  const publicClient = getPublicClient(chainTarget);
  const walletClient = getSettlerWalletClient(chainTarget);
  const txHash = await walletClient.writeContract(
    withBuilderCodeDataSuffix(
      {
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "submitResults",
        args: [onchainId, merkleRoot],
      },
      chainTarget,
    ),
  );

  await publicClient.waitForTransactionReceipt({ hash: txHash });

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

  console.log(`[Settlement] Published on-chain. TX: ${txHash}`);

  return { success: true, merkleRoot, txHash, winnersCount: winners.length };
}

// ============================================================================
// Stage 3: Notify
// ============================================================================

export async function notifyStage(gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      gameNumber: true,
      title: true,
      theme: true,
      prizePool: true,
      platform: true,
    },
  });

  if (!game) {
    console.error("[Settlement] Game not found for notifications:", gameId);
    return;
  }

  const { themeLabel } = await import("@/lib/player/roundQuestions");
  const meta = {
    title: game.title,
    category: themeLabel(game.theme),
    prizePool: game.prizePool ?? undefined,
  };

  const allEntries = await prisma.gameEntry.findMany({
    where: { gameId, user: { isBanned: false } },
    select: {
      userId: true,
      rank: true,
      prize: true,
    },
  });

  const winners = allEntries.filter((e) => (e.prize ?? 0) > 0);
  const nonWinners = allEntries.filter((e) => (e.prize ?? 0) <= 0);

  const { postGame, buildPayload } =
    await import("@/lib/notifications/templates");

  await Promise.allSettled(
    winners.map((entry) => {
      const template = postGame.winner(
        game.gameNumber,
        entry.rank!,
        undefined,
        meta,
        game.platform,
      );
      const payload = buildPayload(template, gameId, "result");
      return sendToUser(entry.userId, payload);
    }),
  );

  if (nonWinners.length > 0) {
    const template = postGame.results(game.gameNumber, meta, game.platform);
    const payload = buildPayload(template, gameId, "result");
    await sendBatch(
      payload,
      nonWinners.map((e) => e.userId),
    );
  }

  const entrantIds = allEntries.map((e) => e.userId);
  const WARM_WINDOW_MS = 24 * 60 * 60 * 1000;
  const warmProgress = await prisma.levelProgress.findMany({
    where: {
      updatedAt: { gte: new Date(Date.now() - WARM_WINDOW_MS) },
      userId: { notIn: entrantIds.length > 0 ? entrantIds : ["__none__"] },
      user: { isBanned: false, platform: game.platform },
    },
    select: { userId: true },
    distinct: ["userId"],
    take: 5000,
  });
  const warmNonBuyers = Array.from(new Set(warmProgress.map((p) => p.userId)));
  if (warmNonBuyers.length > 0) {
    const template = postGame.roundWrap(game.gameNumber, meta, game.platform);
    const payload = buildPayload(template, gameId, "pregame");
    await sendBatch(payload, warmNonBuyers);
  }

  console.log(
    `[Settlement] Sent notifications: ${winners.length} winners, ${nonWinners.length} non-winners, ${warmNonBuyers.length} warm non-buyers`,
  );
}

// ============================================================================
// Pipeline orchestrator
// ============================================================================

/**
 * Full settlement for an ended game: rank → publish (if on-chain winners) → notify.
 * Idempotent — safe for cron retries and admin roundups.
 */
export async function settleGame(gameId: string): Promise<SettleResult> {
  const ranked = await rankStage(gameId);

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { onchainId: true },
  });

  let published = false;
  let publishResult: PublishResult | undefined;

  if (game?.onchainId && ranked.prizesDistributed > 0) {
    publishResult = await publishStage(gameId);
    published = publishResult.success;
  }

  void notifyStage(gameId).catch((err) =>
    console.error("[Settlement] Notification error:", err),
  );

  return { ranked, published, publishResult };
}