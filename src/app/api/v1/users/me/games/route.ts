import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { entryWhere } from "@/lib/platform/query";
import { resolvePlatformGameVisibility } from "@/lib/platform/server";

export const GET = withAuth(async (request: NextRequest, auth) => {
  try {
    const visibility = await resolvePlatformGameVisibility(auth.platform, request);
    const entries = await prisma.gameEntry.findMany({
      where: {
        userId: auth.userId,
        ...entryWhere(auth.platform, visibility),
      },
      select: {
        id: true,
        gameId: true,
        score: true,
        rank: true,
        prize: true,
        paidAt: true,
        purchaseSource: true,
        claimedAt: true,
        answered: true,
        game: {
          select: {
            id: true,
            platform: true,
            gameNumber: true,
            onchainId: true,
            title: true,
            theme: true,
            startsAt: true,
            endsAt: true,
            prizePool: true,
            playerCount: true,
            _count: { select: { questions: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      entries.map((entry) => ({
        id: entry.id,
        gameId: entry.gameId,
        score: entry.score,
        rank: entry.rank,
        prize: entry.prize ?? 0,
        paidAt: entry.paidAt,
        purchaseSource: entry.purchaseSource,
        claimedAt: entry.claimedAt,
        answeredQuestions: entry.answered,
        game: {
          id: entry.game.id,
          gameNumber: entry.game.gameNumber,
          onchainId: entry.game.onchainId,
          title: entry.game.title,
          platform: entry.game.platform,
          theme: entry.game.theme,
          startsAt: entry.game.startsAt,
          endsAt: entry.game.endsAt,
          prizePool: entry.game.prizePool,
          totalQuestions: entry.game._count.questions,
          playersCount: entry.game.playerCount,
        },
      })),
    );
  } catch (error) {
    console.error("GET /api/v1/users/me/games Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
