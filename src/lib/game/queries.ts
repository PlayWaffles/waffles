/**
 * Game Queries
 *
 * Server-side cached queries for fetching game data.
 * Uses React's cache() for request deduplication - multiple calls
 * in the same request will only hit the database once.
 */

import { cache } from "react";
import { prisma } from "@/lib/db";
import { type Game, type UserPlatform } from "@prisma";
import {
  getTicketPricingSnapshot,
  type TicketPricingSnapshot,
} from "@/lib/tickets";
import { gameWhere } from "@/lib/platform/query";
import { resolvePlatformGameVisibility } from "@/lib/platform/server";

// ============================================================================
// Types
// ============================================================================

export type GameWithQuestionCount = Game & {
  questionCount: number;
  pricing: TicketPricingSnapshot;
};

export interface GameQueryResult {
  game: GameWithQuestionCount | null;
}

// ============================================================================
// Include Config
// ============================================================================

/**
 * Prisma include config for fetching recent players and question count
 */
const gameInclude = {
  _count: {
    select: { questions: true },
  },
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetch current live game, next scheduled game, or most recent ended game.
 * Priority: Live > Scheduled > Last Ended
 *
 * This function is cached per-request using React's cache().
 * Multiple components calling this in the same render will only
 * trigger one database query.
 *
 * @returns Game with question count and recent players for avatar display
 */
export const getCurrentOrNextGame = cache(
  async (platform: UserPlatform): Promise<GameQueryResult> => {
    const now = new Date();
    const visibility = await resolvePlatformGameVisibility(platform);

    // Fire both queries in parallel — prefer active game, fall back to ended
    const [activeGame, endedGame] = await Promise.all([
      prisma.game.findFirst({
        where: {
          ...gameWhere(platform, visibility),
          OR: [
            { startsAt: { lte: now }, endsAt: { gt: now } }, // Live
            { startsAt: { gt: now } }, // Scheduled
          ],
        },
        orderBy: [{ startsAt: "asc" }],
        include: gameInclude,
      }),
      prisma.game.findFirst({
        where: { ...gameWhere(platform, visibility), endsAt: { lte: now } },
        orderBy: [{ endsAt: "desc" }],
        include: gameInclude,
      }),
    ]);

    const result = activeGame ?? endedGame;
    if (result) {
      const { _count, ...gameData } = result;
      return {
        game: {
          ...gameData,
          questionCount: _count.questions,
          pricing: getTicketPricingSnapshot(gameData),
        },
      };
    }

    return { game: null };
  }
);

// ============================================================================
// Last Game Winners
// ============================================================================

export interface LastGameWinner {
  username: string | null;
  pfpUrl: string | null;
  prize: number;
  rank: number;
  score: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma entry type coercion
type PrismaWinnerEntry = { rank: number | null; score: number; prize: number | null; user: { username: string | null; pfpUrl: string | null } };

export interface LastGameResult {
  gameNumber: number;
  gameId: string;
  prizePool: number;
  prizeAwarded: number;
  totalWinners: number;
  winners: LastGameWinner[];
}

/**
 * Fetch top 3 winners from the highest-result game (Waffles #004).
 * Used for social proof on the lobby page.
 */
const SHOWCASE_GAME_NUMBER = 4;

export const getLastGameWinners = cache(
  async (platform: UserPlatform): Promise<LastGameResult | null> => {
    const visibility = await resolvePlatformGameVisibility(platform);
    const lastGame = await prisma.game.findFirst({
      where: { ...gameWhere(platform, visibility), gameNumber: SHOWCASE_GAME_NUMBER },
      select: {
        id: true,
        gameNumber: true,
        prizePool: true,
        _count: {
          select: { entries: { where: { prize: { gt: 0 } } } },
        },
        entries: {
          where: { rank: { not: null, lte: 3 } },
          orderBy: { rank: "asc" },
          take: 3,
          select: {
            rank: true,
            score: true,
            prize: true,
            user: {
              select: {
                username: true,
                pfpUrl: true,
              },
            },
          },
        },
      },
    });

    if (!lastGame || lastGame.entries.length === 0) return null;

    const winners = (lastGame.entries as PrismaWinnerEntry[]).map((e) => ({
      username: e.user.username,
      pfpUrl: e.user.pfpUrl,
      prize: e.prize ?? 0,
      rank: e.rank!,
      score: e.score,
    }));

    return {
      gameNumber: lastGame.gameNumber ?? 0,
      gameId: lastGame.id,
      prizePool: lastGame.prizePool ?? 0,
      prizeAwarded: winners.reduce((total, winner) => total + winner.prize, 0),
      totalWinners: lastGame._count.entries,
      winners,
    };
  }
);

/**
 * Fetch a specific game by ID with question count.
 * Cached per-request for deduplication.
 *
 * @param gameId - The game ID to fetch
 * @returns Game with question count and recent players, or null if not found
 */
export const getGameById = cache(
  async (
    gameId: string,
    platform: UserPlatform,
  ): Promise<GameQueryResult> => {
    const visibility = await resolvePlatformGameVisibility(platform);
    const game = await prisma.game.findFirst({
      where: { id: gameId, ...gameWhere(platform, visibility) },
      include: gameInclude,
    });

    if (!game) {
      return { game: null };
    }

    const { _count, ...gameData } = game;
    return {
      game: {
        ...gameData,
        questionCount: _count.questions,
        pricing: getTicketPricingSnapshot(gameData),
      },
    };
  }
);
