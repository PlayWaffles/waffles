import { NextRequest, NextResponse } from "next/server";
import { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { type ApiError } from "@/lib/auth";

type Params = { fid: string };

interface StatsResponse {
  totalGames: number;
  wins: number;
  winRate: number;
  totalWon: number;
  highestScore: number;
  avgScore: number;
  currentStreak: number;
  bestRank: number | null;
}

/**
 * GET /api/v1/users/[fid]/stats
 * Returns user's game statistics (public endpoint)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { fid: fidParam } = await params;
    const fid = parseInt(fidParam, 10);

    if (isNaN(fid)) {
      return NextResponse.json<ApiError>(
        { error: "Invalid fid", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { fid },
      select: {
        id: true,
        platform: true,
        currentStreak: true,
        bestStreak: true,
      },
    });

    if (!user || user.platform !== UserPlatform.FARCASTER) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const userId = user.id;

    const [statsAggregate, winStats, bestRankEntry] =
      await Promise.all([
        prisma.gameEntry.aggregate({
          where: {
            userId,
            paidAt: { not: null },
            game: { platform: UserPlatform.FARCASTER },
          },
          _count: { _all: true },
          _sum: { score: true, prize: true },
          _max: { score: true },
        }),
        prisma.gameEntry.count({
          where: {
            userId,
            rank: 1,
            paidAt: { not: null },
            game: { platform: UserPlatform.FARCASTER },
          },
        }),
        prisma.gameEntry.findFirst({
          where: {
            userId,
            rank: { not: null },
            paidAt: { not: null },
            game: { platform: UserPlatform.FARCASTER },
          },
          orderBy: { rank: "asc" },
          select: { rank: true },
        }),
      ]);

    const totalGames = statsAggregate._count._all;
    const highestScore = statsAggregate._max.score ?? 0;
    const totalScore = statsAggregate._sum.score ?? 0;
    const totalWon = statsAggregate._sum.prize ?? 0;
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    const winRate = totalGames > 0 ? (winStats / totalGames) * 100 : 0;
    const bestRank = bestRankEntry?.rank ?? null;

    const response: StatsResponse = {
      totalGames,
      wins: winStats,
      winRate,
      totalWon,
      highestScore,
      avgScore,
      currentStreak: user.currentStreak,
      bestRank,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/v1/users/[fid]/stats Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
