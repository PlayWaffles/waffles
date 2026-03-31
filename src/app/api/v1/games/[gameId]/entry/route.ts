import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthFromRequest, type ApiError } from "@/lib/auth";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { hasPlayableTicket } from "@/lib/tickets";

type Params = { gameId: string };

/**
 * GET /api/v1/games/:gameId/entry
 * Get a user's entry for a specific game.
 * Uses the authenticated session, with optional legacy fid fallback.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const requestPlatform = await resolveRuntimePlatform(request);
    const { gameId } = await params;
    if (!gameId) {
      return NextResponse.json<ApiError>(
        { error: "Invalid game ID", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const auth = await getAuthFromRequest(request);
    const expectedPlatform = auth?.platform ?? requestPlatform;
    const fidParam = new URL(request.url).searchParams.get("fid");
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, platform: true, isTestnet: true },
    });

    if (!game || !isGameVisibleToPlatform(game, expectedPlatform)) {
      return NextResponse.json<ApiError>(
        { error: "Game not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const legacyFid = fidParam ? parseInt(fidParam, 10) : NaN;
    const user = auth
      ? await prisma.user.findUnique({
          where: { id: auth.userId },
          select: { id: true },
        })
      : !isNaN(legacyFid)
        ? await prisma.user.findUnique({
            where: { fid: legacyFid },
            select: { id: true },
          })
        : null;

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const entry = await prisma.gameEntry.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId: user.id,
        },
      },
      select: {
        id: true,
        score: true,
        answered: true,
        answers: true,
        paidAt: true,
        paidAmount: true,
        purchaseSource: true,
        rank: true,
        prize: true,
        claimedAt: true,
        createdAt: true,
      },
    });

    if (!entry) {
      return NextResponse.json<ApiError>(
        { error: "Entry not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Extract answered question IDs from the answers JSON
    const answersObj = (entry.answers as Record<string, unknown>) || {};
    const answeredQuestionIds = Object.keys(answersObj);

    return NextResponse.json({
      ...entry,
      hasTicket: hasPlayableTicket(entry),
      answers: undefined,
      answeredQuestionIds,
    });
  } catch (error) {
    console.error("GET /api/v1/games/:gameId/entry Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// Note: POST handler moved to Server Action: src/actions/game.ts (purchaseGameTicket)
