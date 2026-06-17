import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGamePhase } from "@/lib/types";
import {
  resolvePlatformGameVisibility,
  resolveRuntimePlatform,
} from "@/lib/platform/server";
import { getTicketPricingSnapshot } from "@/lib/tickets";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

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
    const visibility = await resolvePlatformGameVisibility(platform, request);
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
        isTestnet: true,
        network: true,
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

    if (!game || !isGameVisibleToPlatform(game, platform, visibility)) {
      await trackServerEvent({
        name: "legacy_game_view_failed",
        properties: {
          game_id_hash: hashServerAnalyticsId(gameId),
          platform,
          reason: "not_found",
        },
      });
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

    await trackServerEvent({
      name: "legacy_game_viewed",
      properties: {
        game_id_hash: hashServerAnalyticsId(game.id),
        platform,
        phase: gameWithPhase.status,
        player_count: game.playerCount,
        question_count: game._count.questions,
        entry_count: game._count.entries,
      },
    });

    return NextResponse.json(gameWithPhase);
  } catch (error) {
    console.error("GET /api/v1/games/[gameId] Error:", error);
    await trackServerEvent({
      name: "legacy_game_view_failed",
      properties: {
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
