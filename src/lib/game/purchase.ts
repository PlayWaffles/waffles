import { revalidatePath } from "next/cache";
import { Prisma, TicketPurchaseSource, type UserPlatform } from "@prisma";
import { parseUnits } from "viem";

import { prisma } from "@/lib/db";
import { PAYMENT_TOKEN_DECIMALS, verifyTicketPurchase } from "@/lib/chain";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser } from "@/lib/notifications";
import { formatGameTime } from "@/lib/utils";
import { getTicketPricingSnapshot } from "@/lib/tickets";

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

function revalidateGamePaths() {
  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");
}

function isSamePrice(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

export async function finalizeTicketPurchase(
  user: PurchaseUser,
  input: PurchaseInput,
): Promise<PurchaseResult> {
  const { gameId, txHash, paidAmount, payerWallet } = input;

  console.log("[game-actions]", {
    stage: "purchase-start",
    gameId,
    txHash,
    paidAmount,
    payerWallet,
    userId: user.id,
  });

  if (!gameId || !txHash) {
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

    if (new Date() >= game.endsAt) {
      return { success: false, error: "Game has ended", code: "GAME_ENDED" };
    }

    if (game.playerCount >= game.maxPlayers) {
      return { success: false, error: "Game is full", code: "GAME_FULL" };
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
      txHash: txHash as `0x${string}`,
      expectedGameId: game.onchainId as `0x${string}`,
      expectedBuyer: payerWallet as `0x${string}`,
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

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const transactionResult = await prisma.$transaction(
          async (tx) => {
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

            const currentGame = await tx.game.findUnique({
              where: { id: gameId },
              select: {
                id: true,
                prizePool: true,
                playerCount: true,
                maxPlayers: true,
                tierPrices: true,
              },
            });

            if (!currentGame) {
              throw new Error("Game not found");
            }

            if (currentGame.playerCount >= currentGame.maxPlayers) {
              throw new Error("GAME_FULL");
            }

            const pricing = getTicketPricingSnapshot(currentGame);

            if (!isSamePrice(pricing.currentPrice, paidAmount)) {
              const error = new Error("PRICE_CHANGED");
              error.name = "PRICE_CHANGED";
              throw error;
            }

            const newEntry = await tx.gameEntry.create({
              data: {
                gameId,
                userId: user.id,
                txHash,
                payerWallet: payerWallet || null,
                paidAmount,
                paidAt: new Date(),
                purchaseSource: TicketPurchaseSource.PAID,
              },
              select: { id: true, paidAmount: true, purchaseSource: true },
            });

            const updatedGame = await tx.game.update({
              where: { id: gameId },
              data: {
                playerCount: { increment: 1 },
                prizePool: { increment: paidAmount },
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
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        entry = transactionResult.entry;
        updatedPrizePool = transactionResult.prizePool;
        updatedPlayerCount = transactionResult.playerCount;
        entryWasCreated = transactionResult.wasCreated;
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        ) {
          continue;
        }

        if (error instanceof Error && error.message === "PRICE_CHANGED") {
          return {
            success: false,
            error: "Ticket price changed. Refresh and try again.",
            code: "PRICE_CHANGED",
          };
        }

        if (error instanceof Error && error.message === "GAME_FULL") {
          return {
            success: false,
            error: "Game is full",
            code: "GAME_FULL",
          };
        }

        throw error;
      }
    }

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
    void import("@/lib/notifications/templates").then(
      ({ transactional, buildPayload }) => {
        const payload = buildPayload(transactional.ticketSecured(timeStr));
        sendToUser(user.id, payload).catch((err) =>
          console.error("[game-actions]", "notification_error", {
            gameId,
            userId: user.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      },
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
      void (async () => {
        const { preGame, buildPayload } =
          await import("@/lib/notifications/templates");
        const { sendBatch } = await import("@/lib/notifications");

        const eligibleUsers = await prisma.user.findMany({
          where: {
            hasGameAccess: true,
            isBanned: false,
            entries: { none: { gameId } },
          },
          select: { id: true },
          take: 500,
        });

        if (eligibleUsers.length > 0) {
          const template = preGame.almostSoldOut(game.gameNumber || 0);
          const payload = buildPayload(template, undefined, "pregame");
          await sendBatch(payload, eligibleUsers.map((eligibleUser) => eligibleUser.id));
        }
      })().catch((err) =>
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
