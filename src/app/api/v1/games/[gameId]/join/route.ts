import { NextResponse } from "next/server";
import { withAuth, type AuthResult, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getGamePhase } from "@/lib/types";
import { hasPlayableTicket } from "@/lib/tickets";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { resolvePlatformGameVisibility } from "@/lib/platform/server";

type Params = { gameId: string };

/**
 * POST /api/v1/games/[gameId]/join
 * Join a game (auth required)
 * Creates a game entry if user doesn't have one
 *
 * Note: This is a simplified join - actual ticket purchase uses /entry endpoint
 */
export const POST = withAuth<Params>(
  async (request, auth: AuthResult, params) => {
    try {
      const gameId = params.gameId;
      const visibility = await resolvePlatformGameVisibility(auth.platform, request);

      if (!gameId) {
        return NextResponse.json<ApiError>(
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
          startsAt: true,
          endsAt: true,
        },
      });

      if (!game || !isGameVisibleToPlatform(game, auth.platform, visibility)) {
        return NextResponse.json<ApiError>(
          { error: "Game not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      const phase = getGamePhase(game);
      if (phase === "ENDED") {
        return NextResponse.json<ApiError>(
          { error: "Game has ended", code: "GAME_ENDED" },
          { status: 400 }
        );
      }

      const entry = await prisma.gameEntry.findUnique({
        where: {
          gameId_userId: {
            gameId: gameId,
            userId: auth.userId,
          },
        },
        select: { id: true, paidAt: true, purchaseSource: true },
      });

      if (!entry) {
        return NextResponse.json<ApiError>(
          { error: "Game entry required to join", code: "ENTRY_REQUIRED" },
          { status: 403 }
        );
      }

      if (!hasPlayableTicket(entry)) {
        return NextResponse.json<ApiError>(
          { error: "Ticket required to join", code: "TICKET_REQUIRED" },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, gameId: gameId });
    } catch (error) {
      console.error("POST /api/v1/games/[gameId]/join Error:", error);
      return NextResponse.json<ApiError>(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  }
);
