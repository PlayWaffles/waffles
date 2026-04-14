import { TicketPurchaseSource, type UserPlatform } from "@prisma";
import { formatUnits, parseUnits } from "viem";

import { prisma } from "@/lib/db";
import { PAYMENT_TOKEN_DECIMALS, verifyTicketPurchase } from "@/lib/chain";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser, sendBatch } from "@/lib/notifications";
import { transactional, preGame, buildPayload } from "@/lib/notifications/templates";
import { formatGameTime } from "@/lib/utils";
import { normalizeAddress } from "@/lib/auth";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { resolvePlatformGameVisibility } from "@/lib/platform/server";
import {
  attachWalletToFarcasterUser,
  farcasterUserHasWallet,
  resolveCanonicalFarcasterUser,
  touchFarcasterWalletUsage,
} from "@/lib/user-wallets";
import { calculatePrizePoolContribution } from "@/lib/admin-utils";
import { captureServerEvent } from "@/lib/posthog-server";
import { unlockReferralRewards } from "./shared";
import { areTicketsClosedForGame } from "./ticket-window";

export type PurchaseResult =
  | { success: true; entryId: string }
  | { success: false; error: string; code?: string };

export interface PurchaseInput {
  gameId: string;
  txHash: string;
  paidAmount: number;
  payerWallet: string;
}

interface FinalizeTicketPurchaseOptions {
  onSuccess?: (result: { entryId: string; entryWasCreated: boolean }) => Promise<void> | void;
}

interface PurchaseUser {
  id: string;
  platform: UserPlatform;
  username: string | null;
  pfpUrl: string | null;
  wallet: string | null;
}

const PURCHASE_USER_SELECT = {
  id: true,
  platform: true,
  username: true,
  pfpUrl: true,
  wallet: true,
} as const;

function isSamePrice(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

export async function finalizeTicketPurchase(
  user: PurchaseUser,
  input: PurchaseInput,
  options: FinalizeTicketPurchaseOptions = {},
): Promise<PurchaseResult> {
  const { gameId, txHash, paidAmount, payerWallet } = input;

  const runSuccessHook = async (result: {
    entryId: string;
    entryWasCreated: boolean;
  }) => {
    if (!options.onSuccess) {
      return;
    }

    try {
      await options.onSuccess(result);
    } catch (error) {
      console.error("[game-actions]", "purchase_success_hook_error", {
        gameId,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

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
  const prizePoolContribution = calculatePrizePoolContribution(paidAmount);

  console.log("[game-actions]", {
    stage: "purchase-start",
    gameId,
    txHash,
    paidAmount,
    payerWallet,
    userId: user.id,
  });

  try {
    const visibility = await resolvePlatformGameVisibility(user.platform);
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        platform: true,
        network: true,
        isTestnet: true,
        onchainId: true,
        startsAt: true,
        endsAt: true,
        ticketsOpenAt: true,
        prizePool: true,
        playerCount: true,
        maxPlayers: true,
        tierPrices: true,
        gameNumber: true,
      },
    });

    if (!game || !isGameVisibleToPlatform(game, user.platform, visibility)) {
      return { success: false, error: "Game not found", code: "NOT_FOUND" };
    }

    if (game.ticketsOpenAt && new Date() < game.ticketsOpenAt) {
      return {
        success: false,
        error: "Tickets are not yet available",
        code: "TICKETS_NOT_OPEN",
      };
    }

    if (areTicketsClosedForGame(game)) {
      return {
        success: false,
        error: "Ticket sales have closed",
        code: "TICKETS_CLOSED",
      };
    }

    if (!normalizedPayerWallet) {
      return {
        success: false,
        error: "Invalid payer wallet",
        code: "INVALID_INPUT",
      };
    }

    if (user.platform === "MINIPAY") {
      if (user.wallet && normalizeAddress(user.wallet) !== normalizedPayerWallet) {
        return {
          success: false,
          error: "Payment wallet does not match your linked wallet",
          code: "INVALID_INPUT",
        };
      }
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

    let purchaseUser = user;

    if (user.platform === "FARCASTER") {
      try {
        const resolvedUser = await prisma.$transaction(async (tx) => {
          const canonicalUser = await resolveCanonicalFarcasterUser(
            tx,
            user.id,
            user.username,
          );
          const hasLinkedWallet = await farcasterUserHasWallet(
            tx,
            canonicalUser.id,
            normalizedPayerWallet,
          );

          if (!hasLinkedWallet) {
            await attachWalletToFarcasterUser(
              tx,
              canonicalUser.id,
              normalizedPayerWallet,
            );
          }

          return tx.user.findUnique({
            where: { id: canonicalUser.id },
            select: PURCHASE_USER_SELECT,
          });
        });

        if (!resolvedUser) {
          return {
            success: false,
            error: "User not found",
            code: "NOT_FOUND",
          };
        }

        purchaseUser = resolvedUser;
      } catch (error) {
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Payment wallet is not linked to your Farcaster account",
          code: "INVALID_INPUT",
        };
      }
    }

    const existing = await prisma.gameEntry.findUnique({
      where: { gameId_userId: { gameId, userId: purchaseUser.id } },
    });

    if (existing) {
      await runSuccessHook({ entryId: existing.id, entryWasCreated: false });
      return { success: true, entryId: existing.id };
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
        where: { gameId_userId: { gameId, userId: purchaseUser.id } },
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
          userId: purchaseUser.id,
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
          prizePool: { increment: prizePoolContribution },
        },
        select: { prizePool: true, playerCount: true },
      });

      await unlockReferralRewards(tx, purchaseUser.id);

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

    if (purchaseUser.platform === "FARCASTER") {
      await prisma.$transaction((tx) =>
        touchFarcasterWalletUsage(tx, purchaseUser.id, normalizedPayerWallet),
      );
    }

    if (!entry) {
      return {
        success: false,
        error: "Purchase failed",
        code: "INTERNAL_ERROR",
      };
    }

    await runSuccessHook({ entryId: entry.id, entryWasCreated: entryWasCreated });

    if (!entryWasCreated) {
      return { success: true, entryId: entry.id };
    }

    const timeStr = formatGameTime(game.startsAt);
    void sendToUser(
      purchaseUser.id,
      buildPayload(transactional.ticketSecured(timeStr)),
    ).catch((err) =>
      console.error("[game-actions]", "notification_error", {
        gameId,
        userId: purchaseUser.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    void notifyTicketPurchased(gameId, {
      username: purchaseUser.username || "Player",
      pfpUrl: purchaseUser.pfpUrl || null,
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
      userId: purchaseUser.id,
      paidAmount: entry.paidAmount,
      purchaseSource: entry.purchaseSource,
    });

    await captureServerEvent({
      distinctId: purchaseUser.id,
      event: "ticket_purchase_completed",
      properties: {
        game_id: gameId,
        entry_id: entry.id,
        paid_amount: entry.paidAmount,
        prize_pool_contribution: prizePoolContribution,
        platform: purchaseUser.platform,
        tx_hash: txHash,
      },
    }).catch((err) =>
      console.error("[game-actions]", "posthog_capture_error", {
        event: "ticket_purchase_completed",
        gameId,
        userId: purchaseUser.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

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
