"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma, TicketPurchaseSource } from "@prisma";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser } from "@/lib/notifications";
import { checkAndNotifyFlipped } from "@/lib/notifications/liveNotify";
import { formatGameTime } from "@/lib/utils";
import { getScore } from "@/lib/game/scoring";
import { requireCurrentUser } from "@/lib/auth";
import { getDisplayName } from "@/lib/address";
import { hasPlayableTicket } from "@/lib/tickets";
import {
  finalizeTicketPurchase,
  type PurchaseInput,
  type PurchaseResult,
} from "@/lib/game/purchase";

function revalidateGamePaths() {
  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");
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

/**
 * Records a ticket purchase after on-chain transaction succeeds.
 * Creates game entry, updates prize pool, sends notification, and revalidates cache.
 */
export async function purchaseGameTicket(
  input: PurchaseInput,
): Promise<PurchaseResult> {
  try {
    const { user } = await requireCurrentUser();
    return finalizeTicketPurchase(user, input);
  } catch (error) {
    console.error("[game-actions]", "purchase_error", {
      gameId: input.gameId,
      userId: "unknown",
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Purchase failed", code: "INTERNAL_ERROR" };
  }
}

export type FreeTicketResult =
  | { success: true; entryId: string }
  | { success: false; error: string; code?: string };

type ClaimFreeTicketUser = {
  id: string;
  platform: string;
  username: string | null;
  pfpUrl: string | null;
  wallet?: string | null;
};

async function claimFreeTicketForUser(
  user: ClaimFreeTicketUser,
  gameId: string,
): Promise<FreeTicketResult> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      platform: true,
      startsAt: true,
      endsAt: true,
      playerCount: true,
      maxPlayers: true,
      gameNumber: true,
    },
  });

  if (!game) {
    return { success: false, error: "Game not found", code: "NOT_FOUND" };
  }

  if (game.platform !== user.platform) {
    return { success: false, error: "Wrong platform", code: "WRONG_PLATFORM" };
  }

  if (new Date() >= game.endsAt) {
    return { success: false, error: "Game has ended", code: "GAME_ENDED" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.gameEntry.findUnique({
        where: { gameId_userId: { gameId, userId: user.id } },
        select: { id: true },
      });

      if (existing) {
        return { entryId: existing.id, wasCreated: false, playerCount: game.playerCount };
      }

      const currentGame = await tx.game.findUnique({
        where: { id: gameId },
        select: { playerCount: true, maxPlayers: true },
      });

      if (!currentGame || currentGame.playerCount >= currentGame.maxPlayers) {
        throw new Error("GAME_FULL");
      }

      const entry = await tx.gameEntry.create({
        data: {
          gameId,
          userId: user.id,
          paidAmount: 0,
          purchaseSource: TicketPurchaseSource.FREE_PLAYER,
        },
        select: { id: true },
      });

      const updated = await tx.game.update({
        where: { id: gameId },
        data: { playerCount: { increment: 1 } },
        select: { playerCount: true },
      });

      await unlockReferralRewards(tx, user.id);

      return { entryId: entry.id, wasCreated: true, playerCount: updated.playerCount };
    });

    revalidateGamePaths();

    if (result.wasCreated) {
      notifyTicketPurchased(gameId, {
        username: getDisplayName(user),
        pfpUrl: user.pfpUrl || null,
        prizePool: 0,
        playerCount: result.playerCount,
      }).catch((err) =>
        console.error("[game-actions]", "free_ticket_partykit_error", err),
      );
    }

    return { success: true, entryId: result.entryId };
  } catch (error) {
    if (error instanceof Error && error.message === "GAME_FULL") {
      return { success: false, error: "Game is full", code: "GAME_FULL" };
    }
    throw error;
  }
}

/**
 * Claims a free ticket for a game. No on-chain transaction.
 * Free tickets grant game access but are not eligible for prizes.
 */
export async function claimFreeTicket(
  gameId: string,
): Promise<FreeTicketResult> {
  if (!gameId) {
    return { success: false, error: "Missing game ID", code: "INVALID_INPUT" };
  }

  try {
    const { user } = await requireCurrentUser();
    return claimFreeTicketForUser(user, gameId);
  } catch (error) {
    if (error instanceof Error && error.message === "GAME_FULL") {
      return { success: false, error: "Game is full", code: "GAME_FULL" };
    }
    console.error("[game-actions]", "free_ticket_error", {
      gameId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to claim ticket", code: "INTERNAL_ERROR" };
  }
}

export async function claimFreeTicketForAuthenticatedUser(
  userId: string,
  gameId: string,
): Promise<FreeTicketResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      platform: true,
      username: true,
      pfpUrl: true,
      wallet: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found", code: "NOT_FOUND" };
  }

  try {
    return await claimFreeTicketForUser(user, gameId);
  } catch (error) {
    console.error("[game-actions]", "free_ticket_error", {
      gameId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: "Failed to claim ticket", code: "INTERNAL_ERROR" };
  }
}

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

    revalidateGamePaths();

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
          purchaseSource: true,
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

    if (!hasPlayableTicket(entry)) {
      return {
        success: false,
        error: "Ticket required",
        code: "TICKET_REQUIRED",
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
