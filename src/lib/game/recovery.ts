import { Prisma, TicketPurchaseSource, type UserPlatform } from "@prisma";
import { formatUnits, parseAbiItem } from "viem";

import { prisma } from "@/lib/db";
import { getPublicClient, getWaffleContractAddress, PAYMENT_TOKEN_DECIMALS } from "@/lib/chain";
import { normalizeAddress } from "@/lib/auth";

const BASE_MAINNET_RECOVERY_SCAN_WINDOW = BigInt(500);
const DEFAULT_RECOVERY_SCAN_WINDOW = BigInt(25_000);
const BASE_MAINNET_LOG_BLOCK_CHUNK = BigInt(10);
const DEFAULT_LOG_BLOCK_CHUNK = BigInt(2_000);
const ticketPurchasedEvent = parseAbiItem(
  "event TicketPurchased(bytes32 indexed gameId, address indexed buyer, uint256 amount)",
);

type RecoveryPlatform = Extract<UserPlatform, "FARCASTER" | "MINIPAY">;

type RecentPurchase = {
  txHash: `0x${string}`;
  gameOnchainId: string;
  buyer: string;
  paidAmount: number;
};

function getRecoveryScanWindow(platform: RecoveryPlatform) {
  return platform === "FARCASTER"
    ? BASE_MAINNET_RECOVERY_SCAN_WINDOW
    : DEFAULT_RECOVERY_SCAN_WINDOW;
}

function getLogBlockChunk(platform: RecoveryPlatform) {
  return platform === "FARCASTER"
    ? BASE_MAINNET_LOG_BLOCK_CHUNK
    : DEFAULT_LOG_BLOCK_CHUNK;
}

async function unlockReferralRewards(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const entryCount = await tx.gameEntry.count({
    where: { userId },
  });

  if (entryCount === 1) {
    await tx.referralReward.updateMany({
      where: { inviteeId: userId, status: "PENDING" },
      data: { status: "UNLOCKED", unlockedAt: new Date() },
    });
  }
}

async function getRecentTicketPurchasesForBuyer(
  platform: RecoveryPlatform,
  wallet: string,
): Promise<RecentPurchase[]> {
  const buyer = normalizeAddress(wallet).toLowerCase() as `0x${string}`;
  const publicClient = getPublicClient(platform);
  const contractAddress = getWaffleContractAddress(platform);
  const recoveryScanWindow = getRecoveryScanWindow(platform);
  const logBlockChunk = getLogBlockChunk(platform);
  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock =
    latestBlock > recoveryScanWindow
      ? latestBlock - recoveryScanWindow
      : BigInt(0);

  const logs = [];

  for (let start = fromBlock; start <= latestBlock; start += logBlockChunk) {
    const end =
      start + logBlockChunk - BigInt(1) < latestBlock
        ? start + logBlockChunk - BigInt(1)
        : latestBlock;

    let batch;
    try {
      batch = await publicClient.getLogs({
        address: contractAddress,
        event: ticketPurchasedEvent,
        args: { buyer },
        fromBlock: start,
        toBlock: end,
      });
    } catch (error) {
      console.error("[ticket-recovery]", {
        stage: "get-logs-failed",
        platform,
        buyer,
        contractAddress,
        fromBlock: start.toString(),
        toBlock: end.toString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }

    logs.push(...batch);
  }

  const purchases = logs
    .map((log) => {
      const args = log.args as unknown as {
        gameId: `0x${string}`;
        buyer: `0x${string}`;
        amount: bigint;
      };

      if (!log.transactionHash) {
        return null;
      }

      const paidAmount = Number(
        formatUnits(args.amount, PAYMENT_TOKEN_DECIMALS),
      );

      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        return null;
      }

      return {
        txHash: log.transactionHash,
        gameOnchainId: args.gameId.toLowerCase(),
        buyer: args.buyer.toLowerCase(),
        paidAmount,
      };
    })
    .filter((purchase): purchase is RecentPurchase => purchase !== null);

  return purchases;
}

export async function recoverRecentPurchasesForUser(params: {
  userId: string;
  platform: RecoveryPlatform;
  wallet: string;
}) {
  const wallet = normalizeAddress(params.wallet).toLowerCase();
  const purchases = await getRecentTicketPurchasesForBuyer(params.platform, wallet);

  if (purchases.length === 0) {
    return { recovered: 0, skipped: 0 };
  }

  const uniquePurchases = [...new Map(
    purchases.map((purchase) => [purchase.txHash.toLowerCase(), purchase]),
  ).values()];

  const onchainIds = [...new Set(uniquePurchases.map((purchase) => purchase.gameOnchainId))];
  const txHashes = uniquePurchases.map((purchase) => purchase.txHash);

  const games = await prisma.game.findMany({
    where: {
      platform: params.platform,
      OR: onchainIds.map((onchainId) => ({
        onchainId: { equals: onchainId, mode: "insensitive" },
      })),
    },
    select: {
      id: true,
      onchainId: true,
      rankedAt: true,
      onChainAt: true,
    },
  });

  const gameByOnchainId = new Map(
    games
      .filter((game) => game.onchainId)
      .map((game) => [game.onchainId!.toLowerCase(), game]),
  );

  const existingEntries = await prisma.gameEntry.findMany({
    where: {
      OR: [
        { txHash: { in: txHashes } },
        {
          userId: params.userId,
          gameId: { in: games.map((game) => game.id) },
        },
      ],
    },
    select: {
      txHash: true,
      gameId: true,
      userId: true,
    },
  });

  const existingTxHashes = new Set(
    existingEntries
      .map((entry) => entry.txHash?.toLowerCase())
      .filter((txHash): txHash is string => Boolean(txHash)),
  );
  const existingGameIds = new Set(
    existingEntries
      .filter((entry) => entry.userId === params.userId)
      .map((entry) => entry.gameId),
  );

  let recovered = 0;
  let skipped = 0;

  for (const purchase of uniquePurchases) {
    const game = gameByOnchainId.get(purchase.gameOnchainId);

    if (!game || game.rankedAt || game.onChainAt) {
      skipped += 1;
      continue;
    }

    if (
      existingTxHashes.has(purchase.txHash.toLowerCase()) ||
      existingGameIds.has(game.id)
    ) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.gameEntry.create({
        data: {
          gameId: game.id,
          userId: params.userId,
          txHash: purchase.txHash,
          payerWallet: wallet,
          paidAmount: purchase.paidAmount,
          paidAt: new Date(),
          purchaseSource: TicketPurchaseSource.PAID,
        },
      });

      await tx.game.update({
        where: { id: game.id },
        data: {
          playerCount: { increment: 1 },
          prizePool: { increment: purchase.paidAmount },
        },
      });

      await unlockReferralRewards(tx, params.userId);
    });

    existingTxHashes.add(purchase.txHash.toLowerCase());
    existingGameIds.add(game.id);
    recovered += 1;
  }

  return { recovered, skipped };
}
