import { prisma } from "@/lib/db";
import { ensureNextAutoScheduledGames } from "@/lib/game/auto-schedule";
import { publishResults, rankGame, sendResultNotifications } from "@/lib/game/lifecycle";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";
import {
  sendDueTelegramGameResultAnnouncements,
  sendTelegramGameResults,
} from "@/lib/telegram/waffles-bot";

export type GameRoundupResult = {
  gamesChecked: number;
  ranked: number;
  published: number;
  republished: number;
  failed: number;
  scheduledChecked: number;
  scheduledCreated: number;
  durationMs: number;
};

export async function runGameRoundup(source: string): Promise<GameRoundupResult> {
  const startedAt = Date.now();

  await trackServerEvent({
    name: "cron_roundup_started",
    properties: { source },
  });

  let gamesChecked = 0;
  let ranked = 0;
  let published = 0;
  let republished = 0;
  let failed = 0;

  try {
    const games = await prisma.game.findMany({
      where: { endsAt: { lt: new Date() }, rankedAt: null },
      select: { id: true, onchainId: true },
    });
    gamesChecked = games.length;

    for (const game of games) {
      try {
        const result = await rankGame(game.id);
        ranked++;

        if (game.onchainId && result.prizesDistributed > 0) {
          await publishResults(game.id);
          published++;
        } else {
          sendResultNotifications(game.id).catch((error) =>
            console.error(`[Cron] Notifications failed for ${game.id}:`, error),
          );
        }

        try {
          await sendTelegramGameResults(game.id);
        } catch (error) {
          console.error(`[Cron] Waffles Bot results failed for ${game.id}:`, error);
        }

        console.log(`[Cron] Game ${game.id} rounded up`);
      } catch (error) {
        failed++;
        await trackServerEvent({
          name: "cron_roundup_game_failed",
          properties: {
            source,
            game_id_hash: hashServerAnalyticsId(game.id),
            onchain_game: Boolean(game.onchainId),
            reason: error instanceof Error ? error.name : "unknown",
          },
        });
        console.error(`[Cron] Game ${game.id}:`, error);
      }
    }

    const stuck = await prisma.game.findMany({
      where: {
        endsAt: { lt: new Date() },
        rankedAt: { not: null },
        onChainAt: null,
        onchainId: { not: null },
        entries: { some: { prize: { gt: 0 } } },
      },
      select: { id: true },
    });

    for (const game of stuck) {
      try {
        await publishResults(game.id);
        republished++;
        console.log(`[Cron] Re-published stuck game ${game.id}`);
      } catch (error) {
        failed++;
        await trackServerEvent({
          name: "cron_roundup_republish_failed",
          properties: {
            source,
            game_id_hash: hashServerAnalyticsId(game.id),
            reason: error instanceof Error ? error.name : "unknown",
          },
        });
        console.error(`[Cron] Re-publish failed for ${game.id}:`, error);
      }
    }

    let telegramResultsSent = 0;
    try {
      telegramResultsSent = await sendDueTelegramGameResultAnnouncements();
      if (telegramResultsSent > 0) {
        console.log(`[Cron] Waffles Bot: ${telegramResultsSent} result announcement(s) sent`);
      }
    } catch (error) {
      failed++;
      console.error("[Cron] Waffles Bot result announcements failed:", error);
    }

    const scheduled = await ensureNextAutoScheduledGames();
    const scheduledCreated = scheduled.filter((result) => result.created).length;
    const result = {
      gamesChecked,
      ranked,
      published,
      republished,
      failed,
      scheduledChecked: scheduled.length,
      scheduledCreated,
      durationMs: Date.now() - startedAt,
    };

    await trackServerEvent({
      name: "cron_roundup_succeeded",
      properties: {
        source,
        games_checked: result.gamesChecked,
        ranked: result.ranked,
        published: result.published,
        republished: result.republished,
        failed: result.failed,
        scheduled_checked: result.scheduledChecked,
        scheduled_created: result.scheduledCreated,
        duration_ms: result.durationMs,
      },
    });

    return result;
  } catch (error) {
    await trackServerEvent({
      name: "cron_roundup_failed",
      properties: {
        source,
        games_checked: gamesChecked,
        ranked,
        published,
        republished,
        failed,
        duration_ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    throw error;
  }
}
