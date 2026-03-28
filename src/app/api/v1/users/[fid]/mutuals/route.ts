import { NextRequest, NextResponse } from "next/server";
import { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { type ApiError } from "@/lib/auth";

type Params = { fid: string };

interface Mutual {
  fid: number | null;
  username: string | null;
  pfpUrl: string | null;
}

/**
 * GET /api/v1/users/[fid]/mutuals
 * Get mutual game players (public endpoint)
 * Returns users who have played games together
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
        { error: "Invalid FID", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const context = searchParams.get("context") || "game";

    const user = await prisma.user.findUnique({
      where: { fid },
      select: { id: true, platform: true },
    });

    if (!user || user.platform !== UserPlatform.FARCASTER) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const myEntries = await prisma.gameEntry.findMany({
      where: {
        userId: user.id,
        game: { platform: UserPlatform.FARCASTER },
      },
      select: { gameId: true },
    });

    const myGameIds = myEntries.map((e) => e.gameId);

    const mutualPlayers = await prisma.gameEntry.findMany({
      where: {
        gameId: { in: myGameIds },
        userId: { not: user.id },
        game: { platform: UserPlatform.FARCASTER },
      },
      include: {
        user: {
          select: {
            fid: true,
            username: true,
            pfpUrl: true,
          },
        },
      },
      distinct: ["userId"],
      take: 20,
    });

    const mutuals: Mutual[] = mutualPlayers.map((entry) => ({
      fid: entry.user.fid,
      username: entry.user.username,
      pfpUrl: entry.user.pfpUrl,
    }));

    return NextResponse.json({
      mutuals,
      context,
      count: mutuals.length,
    });
  } catch (error) {
    console.error("GET /api/v1/users/[fid]/mutuals Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
