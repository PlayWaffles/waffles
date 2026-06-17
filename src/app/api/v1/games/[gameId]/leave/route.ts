import { NextResponse } from "next/server";
import { withAuth, type AuthResult, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { resolvePlatformGameVisibility } from "@/lib/platform/server";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

type Params = { gameId: string };

/**
 * POST /api/v1/games/[gameId]/leave
 * Leave/forfeit a game during live phase.
 * Sets leftAt timestamp on GameEntry.
 */
export const POST = withAuth<Params>(
  async (request, auth: AuthResult, params) => {
    try {
      const gameId = params.gameId;
      const visibility = await resolvePlatformGameVisibility(auth.platform, request);
      await trackServerEvent({
        name: "legacy_game_leave_attempted",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(gameId),
          platform: auth.platform,
        },
      });

      if (!gameId) {
        await trackServerEvent({
          name: "legacy_game_leave_rejected",
          userId: auth.userId,
          properties: { reason: "invalid_param" },
        });
        return NextResponse.json<ApiError>(
          { error: "Invalid game ID", code: "INVALID_PARAM" },
          { status: 400 }
        );
      }

      const entry = await prisma.gameEntry.findUnique({
        where: {
          gameId_userId: {
            gameId,
            userId: auth.userId,
          },
        },
        select: {
          id: true,
          leftAt: true,
        game: {
          select: {
            platform: true,
            isTestnet: true,
            network: true,
            startsAt: true,
            endsAt: true,
          },
        },
        },
      });

      if (!entry) {
        await trackServerEvent({
          name: "legacy_game_leave_rejected",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            reason: "not_in_game",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "You are not in this game", code: "NOT_IN_GAME" },
          { status: 404 }
        );
      }

      if (!isGameVisibleToPlatform(entry.game, auth.platform, visibility)) {
        await trackServerEvent({
          name: "legacy_game_leave_rejected",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            reason: "not_visible",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "You are not in this game", code: "NOT_IN_GAME" },
          { status: 404 }
        );
      }

      if (entry.leftAt) {
        // Already left - idempotent, return success
        await trackServerEvent({
          name: "legacy_game_left",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            idempotent: true,
          },
        });
        return NextResponse.json({ success: true, leftAt: entry.leftAt });
      }

      const now = new Date();
      const isLive = now >= entry.game.startsAt && now < entry.game.endsAt;

      if (!isLive) {
        await trackServerEvent({
          name: "legacy_game_leave_rejected",
          userId: auth.userId,
          properties: {
            game_id_hash: hashServerAnalyticsId(gameId),
            platform: auth.platform,
            reason: "not_live",
          },
        });
        return NextResponse.json<ApiError>(
          { error: "You can only leave during a live game", code: "NOT_LIVE" },
          { status: 400 }
        );
      }

      // Mark entry as left (forfeit)
      const updated = await prisma.gameEntry.update({
        where: { id: entry.id },
        data: { leftAt: now },
        select: { leftAt: true },
      });

      await trackServerEvent({
        name: "legacy_game_left",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(gameId),
          platform: auth.platform,
          idempotent: false,
        },
      });

      return NextResponse.json({ success: true, leftAt: updated.leftAt });
    } catch (error) {
      console.error("POST /api/v1/games/[gameId]/leave Error:", error);
      await trackServerEvent({
        name: "legacy_game_leave_rejected",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          platform: auth.platform,
          reason: error instanceof Error ? error.name : "unknown",
        },
      });
      return NextResponse.json<ApiError>(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  }
);
