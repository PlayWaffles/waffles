import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGamePhase } from "@/lib/types";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { getTicketPricingSnapshot } from "@/lib/tickets";

type Params = { gameId: string };

/**
 * GET /api/v1/games/[gameId]
 * Get game details (public endpoint - no auth required)
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

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        platform: true,
        title: true,
        description: true,
        theme: true,
        coverUrl: true,
        startsAt: true,
        endsAt: true,
        tierPrices: true,
        prizePool: true,
        roundBreakSec: true,
        maxPlayers: true,
        playerCount: true,
        _count: {
          select: {
            entries: true,
            questions: true,
          },
        },
        questions: {
          select: {
            id: true,
            content: true,
            mediaUrl: true,
            options: true, // String[] field
            durationSec: true,
            roundIndex: true,
            orderInRound: true,
            points: true,
          },
          orderBy: { orderInRound: "asc" },
        },
      },
    });

    if (!game || game.platform !== platform) {
      return NextResponse.json(
        { error: "Game not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Add computed phase
    const gameWithPhase = {
      ...game,
      status: getGamePhase(game),
      pricing: getTicketPricingSnapshot(game),
    };

    return NextResponse.json(gameWithPhase);
  } catch (error) {
    console.error("GET /api/v1/games/[gameId] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
