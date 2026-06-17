/**
 * Cron: Roundup Games
 * POST /api/cron/roundup-games
 *
 * Auto-ranks and publishes ended games that haven't settled yet. Called every 5 min.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  rankGame,
  publishResults,
} from "@/lib/game/lifecycle";
import { ensureNextAutoScheduledGames } from "@/lib/game/auto-schedule";
import { env } from "@/lib/env";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (request.headers.get("Authorization") !== `Bearer ${env.authSecret}`) {
    await trackServerEvent({
      name: "legacy_cron_roundup_unauthorized",
      properties: { cron: "roundup-games" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await trackServerEvent({
    name: "legacy_cron_roundup_started",
    properties: { cron: "roundup-games" },
  });

  let ranked = 0,
    published = 0,
    gamesChecked = 0;

  try {
    const games = await prisma.game.findMany({
      where: { endsAt: { lt: new Date() }, rankedAt: null },
      select: { id: true, onchainId: true },
    });
    gamesChecked = games.length;

    if (games.length > 0) {
      for (const game of games) {
        try {
          const result = await rankGame(game.id);
          ranked++;

          if (game.onchainId && result.prizesDistributed > 0) {
            // On-chain: publishResults handles notifications
            await publishResults(game.id);
            published++;
          } else {
            // Off-chain: send notifications directly
            // await sendResultNotifications(game.id);
          }

          console.log(`[Cron] Game ${game.id} rounded up (fallback)`);
        } catch (e) {
          await trackServerEvent({
            name: "legacy_cron_roundup_game_failed",
            properties: {
              game_id_hash: hashServerAnalyticsId(game.id),
              onchain_game: Boolean(game.onchainId),
              reason: e instanceof Error ? e.name : "unknown",
            },
          });
          console.error(`[Cron] Game ${game.id}:`, e);
        }
      }
    }

    const scheduled = await ensureNextAutoScheduledGames();
    const created = scheduled.filter((result) => result.created).length;

    await trackServerEvent({
      name: "legacy_cron_roundup_succeeded",
      properties: {
        games_checked: games.length,
        ranked,
        published,
        scheduled_checked: scheduled.length,
        scheduled_created: created,
        duration_ms: Date.now() - startedAt,
      },
    });

    console.log(
      `[Cron] Done: ${ranked} ranked, ${published} published, ${created} scheduled`,
    );
    return NextResponse.json({ ranked, published, scheduled });
  } catch (error) {
    await trackServerEvent({
      name: "legacy_cron_roundup_failed",
      properties: {
        games_checked: gamesChecked,
        ranked,
        published,
        duration_ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    throw error;
  }
}
