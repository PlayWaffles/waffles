import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRuntimePlatform } from "@/lib/platform/server";

type Params = { gameId: string };

interface LeaderboardEntry {
  rank: number;
  userId: string;
  fid: number | null;
  wallet: string | null;
  username: string | null;
  pfpUrl: string | null;
  score: number;
}

/**
 * GET /api/v1/games/[gameId]/leaderboard
 * Get game leaderboard (public endpoint - no auth required)
 * Query params:
 *   - limit: max results (default 50)
 *   - offset: pagination offset (default 0)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const platform = await resolveRuntimePlatform(request);
    const { gameId } = await context.params;

    if (!gameId) {
      return NextResponse.json(
        { error: "Invalid game ID", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, platform: true },
    });

    if (!game || game.platform !== platform) {
      return NextResponse.json(
        { error: "Game not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const entries = await prisma.gameEntry.findMany({
      where: {
        gameId: gameId,
      },
      include: {
        user: {
          select: {
            id: true,
            fid: true,
            wallet: true,
            username: true,
            pfpUrl: true,
          },
        },
      },
      orderBy: { score: "desc" },
      take: limit,
      skip: offset,
    });

    const leaderboard: LeaderboardEntry[] = entries.map((entry, index) => ({
      rank: offset + index + 1,
      userId: entry.user.id,
      fid: entry.user.fid,
      wallet: entry.user.wallet,
      username: entry.user.username,
      pfpUrl: entry.user.pfpUrl,
      score: entry.score,
    }));

    const totalCount = await prisma.gameEntry.count({
      where: {
        gameId: gameId,
      },
    });

    return NextResponse.json({
      leaderboard,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/games/[gameId]/leaderboard Error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
