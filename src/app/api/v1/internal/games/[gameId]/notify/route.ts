import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendBatch } from "@/lib/notifications";
import { env } from "@/lib/env";

const SERVICE = "notify-api";

type Params = { gameId: string };

/**
 * POST /api/v1/internal/games/:gameId/notify
 * Send notifications to all users with game access.
 * Called by PartyKit for game events (starting soon, started, ended).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const { gameId } = await context.params;

  console.log("["+SERVICE+"]", "notify_request_received", {
    gameId,
    source: "partykit",
  });

  try {
    if (!gameId) {
      console.warn("["+SERVICE+"]", "notify_invalid_game_id", { gameId });
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    // Verify Authorization header (called from PartyKit)
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${env.partykitSecret}`) {
      console.warn("["+SERVICE+"]", "notify_unauthorized", {
        gameId,
        message: "Invalid authorization header",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const message = body.message || "Game update";

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, title: true, platform: true },
    });

    if (!game) {
      console.error("["+SERVICE+"]", "notify_game_not_found", { gameId });
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const users = await prisma.user.findMany({
      where: {
        platform: game.platform,
        isBanned: false,
      },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    console.log("["+SERVICE+"]", "notify_sending_batch", {
      gameId,
      gameTitle: game.title,
      message,
      recipientCount: userIds.length,
    });

    const results = await sendBatch(
      {
        title: game.title || "Waffle Game",
        body: message,
        targetUrl: `${env.rootUrl}/game`,
      },
      userIds,
    );

    console.log("["+SERVICE+"]", "notify_batch_complete", {
      gameId,
      message,
      success: results.success,
      failed: results.failed,
      invalidTokens: results.invalidTokens,
      rateLimited: results.rateLimited,
      total: results.total,
    });

    return NextResponse.json({
      success: true,
      notified: results.success,
      failed: results.failed + results.invalidTokens + results.rateLimited,
      total: results.total,
    });
  } catch (error) {
    console.error("["+SERVICE+"]", "notify_error", {
      gameId,
      error: (error instanceof Error ? error.message : String(error)),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
