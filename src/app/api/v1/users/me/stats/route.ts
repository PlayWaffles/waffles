import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { entryWhere } from "@/lib/platform/query";

export const GET = withAuth(async (_request: NextRequest, auth) => {
  try {
    const userId = auth.userId;
    const platformFilter = entryWhere(auth.platform);
    const [user, statsAggregate, winStats, bestRankEntry] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            currentStreak: true,
            bestStreak: true,
          },
        }),
        prisma.gameEntry.aggregate({
          where: {
            userId,
            ...platformFilter,
          },
          _count: { _all: true },
          _sum: { score: true, prize: true },
          _max: { score: true },
        }),
        prisma.gameEntry.count({
          where: {
            userId,
            rank: 1,
            ...platformFilter,
          },
        }),
        prisma.gameEntry.findFirst({
          where: {
            userId,
            rank: { not: null },
            ...platformFilter,
          },
          orderBy: { rank: "asc" },
          select: { rank: true },
        }),
      ]);

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const totalGames = statsAggregate._count._all;
    const highestScore = statsAggregate._max.score ?? 0;
    const totalScore = statsAggregate._sum.score ?? 0;
    const totalWon = statsAggregate._sum.prize ?? 0;
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    const winRate = totalGames > 0 ? (winStats / totalGames) * 100 : 0;
    const bestRank = bestRankEntry?.rank ?? null;

    return NextResponse.json({
      totalGames,
      wins: winStats,
      winRate,
      totalWon,
      highestScore,
      avgScore,
      currentStreak: user.currentStreak,
      bestRank,
    });
  } catch (error) {
    console.error("GET /api/v1/users/me/stats Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
