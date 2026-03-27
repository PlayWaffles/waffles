"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser } from "@/lib/notifications";
import { checkAndNotifyFlipped } from "@/lib/notifications/liveNotify";
import { env } from "@/lib/env";
import { PAYMENT_TOKEN_DECIMALS, verifyTicketPurchase } from "@/lib/chain";
import { parseUnits } from "viem";
import { formatGameTime } from "@/lib/utils";
import { getScore } from "@/lib/game/scoring";
import { requireCurrentUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/address";

// ============================================================================
// Types
// ============================================================================

export type PurchaseResult =
  | { success: true; entryId: string }
  | { success: false; error: string; code?: string };

interface PurchaseInput {
  gameId: string;
  txHash: string;
  paidAmount: number;
  payerWallet: string;
}

// ============================================================================
// Server Action: Purchase Game Ticket
// ============================================================================

/**
 * Records a ticket purchase after on-chain transaction succeeds.
 * Creates game entry, updates prize pool, sends notification, and revalidates cache.
 */
export async function purchaseGameTicket(
  input: PurchaseInput,
): Promise<PurchaseResult> {
  const { gameId, txHash, paidAmount, payerWallet } = input;

  // Validate input
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
    const { user } = await requireCurrentUser();

    // Check if entry already exists (idempotent)
    const existing = await prisma.gameEntry.findUnique({
      where: { gameId_userId: { gameId, userId: user.id } },
    });

    if (existing) {
      // Entry exists - revalidate and return success
      revalidatePath("/game");
      revalidatePath("/(app)/(game)", "layout");
      return { success: true, entryId: existing.id };
    }

    // Verify game exists and is valid
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

    if (game.platform !== user.platform) {
      return {
        success: false,
        error: "This game belongs to a different platform",
        code: "WRONG_PLATFORM",
      };
    }

    // Validate payment amount against allowed tiers
    const isValidTier = game.tierPrices.some(
      (price) => Math.abs(price - paidAmount) < 0.0001,
    );
    if (!isValidTier) {
      return {
        success: false,
        error: `Invalid payment tier. Allowed: ${game.tierPrices.join(", ")}`,
        code: "INVALID_INPUT",
      };
    }

    // Check game status
    if (new Date() >= game.endsAt) {
      return { success: false, error: "Game has ended", code: "GAME_ENDED" };
    }

    if (game.playerCount >= game.maxPlayers) {
      return { success: false, error: "Game is full", code: "GAME_FULL" };
    }

    // =========================================================================
    // CRITICAL: Verify payment on-chain before recording
    // =========================================================================
    if (!game.onchainId) {
      return {
        success: false,
        error: "Game not deployed on-chain",
        code: "NOT_ONCHAIN",
      };
    }

    const verification = await verifyTicketPurchase({
      txHash: txHash as `0x${string}`,
      expectedGameId: game.onchainId as `0x${string}`,
      expectedBuyer: payerWallet as `0x${string}`,
      minimumAmount: parseUnits(paidAmount.toString(), PAYMENT_TOKEN_DECIMALS),
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

    console.log("[game-actions]", "payment_verified", {
      gameId,
      userId: user.id,
      txHash,
      verifiedAmount: verification.details?.amountFormatted,
    });

    // Create entry and update game atomically
    const entry = await prisma.$transaction(async (tx) => {
      const newEntry = await tx.gameEntry.create({
        data: {
          gameId,
          userId: user.id,
          txHash,
          payerWallet: payerWallet || null,
          paidAmount,
          paidAt: new Date(),
        },
      });

      await tx.game.update({
        where: { id: gameId },
        data: {
          playerCount: { increment: 1 },
          prizePool: { increment: paidAmount },
        },
      });

      // Check if first game - unlock referral rewards
      const entryCount = await tx.gameEntry.count({
        where: { userId: user.id },
      });

      if (entryCount === 1) {
        await tx.referralReward.updateMany({
          where: { inviteeId: user.id, status: "PENDING" },
          data: { status: "UNLOCKED", unlockedAt: new Date() },
        });
      }

      return newEntry;
    });

    // Revalidate cache - THE KEY FIX FOR STALE DATA
    revalidatePath("/game");
    revalidatePath("/(app)/(game)", "layout");

    // Async: Send notification (don't await)
    const timeStr = formatGameTime(game.startsAt);
    import("@/lib/notifications/templates").then(
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

    // Async: Notify PartyKit of ticket purchase (stats + entrant atomically)
    notifyTicketPurchased(gameId, {
      username: user.username || "Player",
      pfpUrl: user.pfpUrl || null,
      prizePool: game.prizePool + paidAmount,
      playerCount: game.playerCount + 1,
    }).catch((err) =>
      console.error("[game-actions]", "partykit_notify_error", {
        gameId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );

    // =========================================================================
    // ALMOST SOLD OUT NOTIFICATION (90% Threshold)
    // =========================================================================
    const playerThreshold = Math.floor(game.maxPlayers * 0.9);
    const newCount = game.playerCount + 1; // +1 because we just added this user

    // Only fire exactly when crossing the threshold (idempotent-ish)
    if (newCount === playerThreshold) {
      // Import dynamically to avoid circular deps
      const { preGame, buildPayload } =
        await import("@/lib/notifications/templates");
      const { sendBatch } = await import("@/lib/notifications");

      // Find users with game access who haven't bought a ticket yet
      const eligibleUsers = await prisma.user.findMany({
        where: {
          hasGameAccess: true,
          isBanned: false,
          entries: {
            none: { gameId }, // User has NOT entered this game
          },
        },
        select: { id: true },
        take: 500, // Limit blast radius
      });

      if (eligibleUsers.length > 0) {
        const template = preGame.almostSoldOut(game.gameNumber || 0);
        const payload = buildPayload(template, undefined, "pregame");

        console.log("[game-actions]", "triggering_sold_out_notify", {
          gameId,
          threshold: playerThreshold,
          recipients: eligibleUsers.length,
        });

        sendBatch(payload, eligibleUsers.map((u) => u.id)).catch((err) =>
          console.error("[game-actions]", "sold_out_notify_error", err),
        );
      }
    }

    console.log("[game-actions]", "ticket_purchased", {
      gameId,
      entryId: entry.id,
      userId: user.id,
      paidAmount,
    });

    return { success: true, entryId: entry.id };
  } catch (error) {
    console.error("[game-actions]", "purchase_error", {
      gameId,
      userId: "unknown",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Purchase failed", code: "INTERNAL_ERROR" };
  }
}

// ============================================================================
// Server Action: Leave Game
// ============================================================================

export type LeaveGameResult =
  | { success: true; leftAt: Date }
  | { success: false; error: string; code?: string };

interface LeaveGameInput {
  gameId: string;
}

/**
 * Leaves/forfeits a game during live phase.
 * Sets leftAt timestamp on GameEntry.
 */
export async function leaveGame(
  input: LeaveGameInput,
): Promise<LeaveGameResult> {
  const { gameId } = input;
  let currentUserId = "unknown";

  if (!gameId) {
    return {
      success: false,
      error: "Missing required fields",
      code: "INVALID_INPUT",
    };
  }

  try {
    const { user } = await requireCurrentUser();
    currentUserId = user.id;

    const entry = await prisma.gameEntry.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        leftAt: true,
        game: {
          select: {
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });

    if (!entry) {
      return { success: false, error: "Not in this game", code: "NOT_IN_GAME" };
    }

    if (entry.leftAt) {
      return { success: true, leftAt: entry.leftAt };
    }

    const now = new Date();
    const isLive = now >= entry.game.startsAt && now < entry.game.endsAt;

    if (!isLive) {
      return {
        success: false,
        error: "Can only leave during live game",
        code: "NOT_LIVE",
      };
    }

    const updated = await prisma.gameEntry.update({
      where: { id: entry.id },
      data: { leftAt: now },
      select: { leftAt: true },
    });

    revalidatePath("/game");
    revalidatePath("/(app)/(game)", "layout");

    console.log("[game-actions]", "game_left", { gameId, userId: user.id });

    return { success: true, leftAt: updated.leftAt! };
  } catch (error) {
    console.error("[game-actions]", "leave_error", {
      gameId,
      userId: currentUserId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "Failed to leave game",
      code: "INTERNAL_ERROR",
    };
  }
}

// ============================================================================
// Server Action: Submit Answer
// ============================================================================

export type SubmitAnswerResult =
  | {
      success: true;
      isCorrect: boolean;
      pointsEarned: number;
      totalScore: number;
    }
  | { success: false; error: string; code?: string };

interface SubmitAnswerInput {
  gameId: string;
  questionId: string;
  selectedIndex: number | null;
  timeTakenMs: number;
}

interface AnswerEntry {
  selected: number;
  correct: boolean;
  points: number;
  ms: number;
}

/**
 * Submit an answer for a question in a live game.
 */
export async function submitAnswer(
  input: SubmitAnswerInput,
): Promise<SubmitAnswerResult> {
  const { gameId, questionId, selectedIndex, timeTakenMs } = input;
  let currentUserId = "unknown";

  // 1. VALIDATE INPUT
  if (!gameId || !questionId) {
    return {
      success: false,
      error: "Missing required fields",
      code: "INVALID_INPUT",
    };
  }

  const selectedIndexValue = selectedIndex ?? -1;

  try {
    const { user } = await requireCurrentUser();
    currentUserId = user.id;

    // Fetch game, entry, and question in parallel
    const [game, entry, question] = await Promise.all([
      prisma.game.findUnique({
        where: { id: gameId },
        select: { startsAt: true, endsAt: true, gameNumber: true },
      }),
      prisma.gameEntry.findUnique({
        where: { gameId_userId: { gameId, userId: user.id } },
        select: {
          id: true,
          score: true,
          answered: true,
          answers: true,
          paidAt: true,
          leftAt: true,
        },
      }),
      prisma.question.findUnique({
        where: { id: questionId },
        select: { correctIndex: true, durationSec: true, gameId: true },
      }),
    ]);

    if (!game) {
      return { success: false, error: "Game not found", code: "NOT_FOUND" };
    }

    const now = new Date();
    if (now < game.startsAt) {
      return { success: false, error: "Game not started", code: "NOT_STARTED" };
    }
    if (now > game.endsAt) {
      return { success: false, error: "Game has ended", code: "GAME_ENDED" };
    }

    if (!entry) {
      return { success: false, error: "Not in this game", code: "NOT_IN_GAME" };
    }

    if (!entry.paidAt) {
      return {
        success: false,
        error: "Payment required",
        code: "PAYMENT_REQUIRED",
      };
    }

    if (entry.leftAt) {
      return { success: false, error: "You left this game", code: "LEFT_GAME" };
    }

    if (!question) {
      return { success: false, error: "Question not found", code: "NOT_FOUND" };
    }

    if (question.gameId !== gameId) {
      return {
        success: false,
        error: "Question not in this game",
        code: "INVALID_QUESTION",
      };
    }

    // 6. CHECK IF ALREADY ANSWERED (idempotent)
    const existingAnswers =
      (entry.answers as unknown as Record<string, AnswerEntry>) || {};
    const questionKey = String(questionId);

    if (existingAnswers[questionKey]) {
      const existing = existingAnswers[questionKey];
      return {
        success: true,
        isCorrect: existing.correct,
        pointsEarned: existing.points,
        totalScore: entry.score,
      };
    }

    // 7. CALCULATE SCORE
    const maxTimeSec = question.durationSec ?? 10;
    const isCorrect = selectedIndexValue === question.correctIndex;
    const pointsEarned = getScore(timeTakenMs, maxTimeSec, isCorrect);

    // 8. ATOMIC UPDATE (prevents race conditions)
    const updatedEntry = await prisma.$transaction(async (tx) => {
      // Re-fetch entry to get latest state inside transaction
      const currentEntry = await tx.gameEntry.findUnique({
        where: { id: entry.id },
        select: { score: true, answered: true, answers: true },
      });

      if (!currentEntry) {
        throw new Error("Entry not found");
      }

      const currentAnswers =
        (currentEntry.answers as unknown as Record<string, AnswerEntry>) || {};

      // Double-check idempotency inside transaction
      if (currentAnswers[questionKey]) {
        return {
          alreadyAnswered: true,
          existing: currentAnswers[questionKey],
          score: currentEntry.score,
        };
      }

      const newAnswer: AnswerEntry = {
        selected: selectedIndexValue,
        correct: isCorrect,
        points: pointsEarned,
        ms: timeTakenMs,
      };

      const updatedAnswers = {
        ...currentAnswers,
        [questionKey]: newAnswer,
      } as unknown as Prisma.JsonObject;

      const updated = await tx.gameEntry.update({
        where: { id: entry.id },
        data: {
          answers: updatedAnswers,
          score: currentEntry.score + pointsEarned,
          answered: currentEntry.answered + 1,
        },
        select: { score: true },
      });

      return {
        alreadyAnswered: false,
        score: updated.score,
      };
    });

    // Handle race condition: another request answered first
    if (updatedEntry.alreadyAnswered && "existing" in updatedEntry) {
      const existing = updatedEntry.existing!;
      return {
        success: true,
        isCorrect: existing.correct,
        pointsEarned: existing.points,
        totalScore: updatedEntry.score,
      };
    }

    // 9. CHECK FOR LEADERBOARD FLIPS (async, non-blocking)
    checkAndNotifyFlipped(
      gameId,
      game.gameNumber,
      user.id,
      getDisplayName({ username: user.username, wallet: user.wallet }),
      updatedEntry.score,
    ).catch((err) => console.error("[game-actions] flip_check_error", err));

    return {
      success: true,
      isCorrect,
      pointsEarned,
      totalScore: updatedEntry.score,
    };
  } catch (error) {
    console.error("[game-actions] answer_error", {
      gameId,
      userId: currentUserId,
      questionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: "Failed to submit answer",
      code: "INTERNAL_ERROR",
    };
  }
}
