import { TicketPurchaseSource, type UserPlatform } from "@prisma";
import { formatUnits, parseUnits } from "viem";

import { prisma } from "@/lib/db";
import { PAYMENT_TOKEN_DECIMALS, verifyTicketPurchase } from "@/lib/chain";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser, sendBatch } from "@/lib/notifications";
import { transactional, preGame, buildPayload } from "@/lib/notifications/templates";
import { formatGameTime } from "@/lib/utils";
import { normalizeAddress } from "@/lib/auth";
import { unlockReferralRewards, revalidateGamePaths } from "./shared";

export type PurchaseResult =
  | { success: true; entryId: string }
  | { success: false; error: string; code?: string };

export interface PurchaseInput {
  gameId: string;
  txHash: string;
  paidAmount: number;
  payerWallet: string;
}

interface PurchaseUser {
  id: string;
  platform: UserPlatform;
  username: string | null;
  pfpUrl: string | null;
  wallet: string | null;
}

function isSamePrice(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

export async function finalizeTicketPurchase(
  user: PurchaseUser,
  input: PurchaseInput,
): Promise<PurchaseResult> {
  const { gameId, txHash, paidAmount, payerWallet } = input;

  if (!gameId || !txHash || !payerWallet) {
    return {
      success: false,
      error: "Missing required fields",
      code: "INVALID_INPUT",
    };
  }

  if (typeof paidAmount !== "number" || paidAmount <= 0) {
    return {
      success: false,
      error: "Invalid payment amount",
      code: "INVALID_INPUT",
    };
  }

  const normalizedPayerWallet = normalizeAddress(payerWallet);

  console.log("[game-actions]", {
    stage: "purchase-start",
    gameId,
    txHash,
    paidAmount,
    payerWallet,
    userId: user.id,
  });

  try {
    const existing = await prisma.gameEntry.findUnique({
      where: { gameId_userId: { gameId, userId: user.id } },
    });

    if (existing) {
      revalidateGamePaths();
      return { success: true, entryId: existing.id };
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        platform: true,
        network: true,
        onchainId: true,
        startsAt: true,
        endsAt: true,
        prizePool: true,
        playerCount: true,
        maxPlayers: true,
        tierPrices: true,
        gameNumber: true,
      },
    });

    if (!game) {
      return { success: false, error: "Game not found", code: "NOT_FOUND" };
    }

    if (!normalizedPayerWallet) {
      return {
        success: false,
        error: "Invalid payer wallet",
        code: "INVALID_INPUT",
      };
    }

    if (user.wallet && normalizeAddress(user.wallet) !== normalizedPayerWallet) {
      return {
        success: false,
        error: "Payment wallet does not match your linked wallet",
        code: "INVALID_INPUT",
      };
    }

    console.log("[game-actions]", {
      stage: "purchase-game-loaded",
      gameId,
      platform: game.platform,
      onchainId: game.onchainId,
      tierPrices: game.tierPrices,
      playerCount: game.playerCount,
      maxPlayers: game.maxPlayers,
    });

    if (game.platform !== user.platform) {
      return {
        success: false,
        error: "This game belongs to a different platform",
        code: "WRONG_PLATFORM",
      };
    }

    const pricingCandidates = (game.tierPrices ?? []).filter(
      (price): price is number => typeof price === "number" && price > 0,
    );

    if (!pricingCandidates.some((price) => isSamePrice(price, paidAmount))) {
      return {
        success: false,
        error: "Invalid payment amount",
        code: "INVALID_INPUT",
      };
    }

    if (!game.onchainId) {
      return {
        success: false,
        error: "Game not deployed on-chain",
        code: "NOT_ONCHAIN",
      };
    }

    const verification = await verifyTicketPurchase({
      platform: game.platform,
      network: game.network,
      txHash: txHash as `0x${string}`,
      expectedGameId: game.onchainId as `0x${string}`,
      expectedBuyer: normalizedPayerWallet as `0x${string}`,
      minimumAmount: parseUnits(paidAmount.toString(), PAYMENT_TOKEN_DECIMALS),
    });

    console.log("[game-actions]", {
      stage: "purchase-verification-result",
      gameId,
      txHash,
      platform: game.platform,
      expectedBuyer: payerWallet,
      verified: verification.verified,
      error: verification.error,
      details: verification.details
        ? {
            gameId: verification.details.gameId,
            buyer: verification.details.buyer,
            amount: verification.details.amount.toString(),
            amountFormatted: verification.details.amountFormatted,
          }
        : null,
    });

    if (!verification.verified) {
      console.error("[game-actions]", "payment_verification_failed", {
        gameId,
        userId: user.id,
        txHash,
        payerWallet,
        error: verification.error,
      });
      return {
        success: false,
        error: verification.error || "Payment verification failed",
        code: "VERIFICATION_FAILED",
      };
    }

    const verifiedPaidAmount = Number(
      formatUnits(
        verification.details?.amount ??
          parseUnits(paidAmount.toString(), PAYMENT_TOKEN_DECIMALS),
        PAYMENT_TOKEN_DECIMALS,
      ),
    );

    if (!Number.isFinite(verifiedPaidAmount) || verifiedPaidAmount <= 0) {
      return {
        success: false,
        error: "Unable to derive paid amount from on-chain purchase",
        code: "VERIFICATION_FAILED",
      };
    }

    let entry:
      | {
          id: string;
          paidAmount: number | null;
          purchaseSource: TicketPurchaseSource;
        }
      | null = null;
    let entryWasCreated = false;
    let updatedPrizePool = game.prizePool;
    let updatedPlayerCount = game.playerCount;

    const transactionResult = await prisma.$transaction(async (tx) => {
      const existingEntry = await tx.gameEntry.findUnique({
        where: { gameId_userId: { gameId, userId: user.id } },
        select: { id: true, purchaseSource: true, paidAmount: true },
      });

      if (existingEntry) {
        return {
          entry: existingEntry,
          prizePool: game.prizePool,
          playerCount: game.playerCount,
          wasCreated: false,
        };
      }

      const newEntry = await tx.gameEntry.create({
        data: {
          gameId,
          userId: user.id,
          txHash,
          payerWallet: normalizedPayerWallet,
          paidAmount: verifiedPaidAmount,
          paidAt: new Date(),
          purchaseSource: TicketPurchaseSource.PAID,
        },
        select: { id: true, paidAmount: true, purchaseSource: true },
      });

      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: {
          playerCount: { increment: 1 },
          prizePool: { increment: verifiedPaidAmount },
        },
        select: { prizePool: true, playerCount: true },
      });

      await unlockReferralRewards(tx, user.id);

      return {
        entry: newEntry,
        prizePool: updatedGame.prizePool,
        playerCount: updatedGame.playerCount,
        wasCreated: true,
      };
    });

    entry = transactionResult.entry;
    updatedPrizePool = transactionResult.prizePool;
    updatedPlayerCount = transactionResult.playerCount;
    entryWasCreated = transactionResult.wasCreated;

    if (!entry) {
      return {
        success: false,
        error: "Purchase failed",
        code: "INTERNAL_ERROR",
      };
    }

    revalidateGamePaths();

    if (!entryWasCreated) {
      return { success: true, entryId: entry.id };
    }

    const timeStr = formatGameTime(game.startsAt);
    void sendToUser(user.id, buildPayload(transactional.ticketSecured(timeStr))).catch((err) =>
      console.error("[game-actions]", "notification_error", {
        gameId,
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    void notifyTicketPurchased(gameId, {
      username: user.username || "Player",
      pfpUrl: user.pfpUrl || null,
      prizePool: updatedPrizePool,
      playerCount: updatedPlayerCount,
    }).catch((err) =>
      console.error("[game-actions]", "partykit_notify_error", {
        gameId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    const playerThreshold = Math.floor(game.maxPlayers * 0.9);
    const newCount = updatedPlayerCount;

    if (newCount === playerThreshold) {
      void prisma.user.findMany({
        where: {
          hasGameAccess: true,
          isBanned: false,
          entries: { none: { gameId } },
        },
        select: { id: true },
        take: 500,
      }).then((eligibleUsers) => {
        if (eligibleUsers.length > 0) {
          const template = preGame.almostSoldOut(game.gameNumber || 0);
          const payload = buildPayload(template, undefined, "pregame");
          return sendBatch(payload, eligibleUsers.map((u) => u.id));
        }
      }).catch((err) =>
        console.error("[game-actions]", "sold_out_notify_error", err),
      );
    }

    console.log("[game-actions]", "ticket_purchased", {
      gameId,
      entryId: entry.id,
      userId: user.id,
      paidAmount: entry.paidAmount,
      purchaseSource: entry.purchaseSource,
    });

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("[game-actions]", "purchase_error", {
      gameId,
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Purchase failed", code: "INTERNAL_ERROR" };
  }
}
