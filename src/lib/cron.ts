import cron from "node-cron";
import { prisma } from "@/lib/db";
import { rankGame, publishResults, sendResultNotifications } from "@/lib/game/lifecycle";

/**
 * Roundup ended games that weren't processed by PartyKit alarm.
 * Finds games where endsAt < now AND rankedAt is null, then ranks + publishes.
 */
async function roundupGames() {
  try {
    const games = await prisma.game.findMany({
      where: { endsAt: { lt: new Date() }, rankedAt: null },
      select: { id: true, onchainId: true },
    });

    if (!games.length) return;

    let ranked = 0;
    let published = 0;

    for (const game of games) {
      try {
        const result = await rankGame(game.id);
        ranked++;

        if (game.onchainId && result.prizesDistributed > 0) {
          await publishResults(game.id);
          published++;
        } else {
          sendResultNotifications(game.id).catch((e) =>
            console.error(`[Cron] Notifications failed for ${game.id}:`, e)
          );
        }

        console.log(`[Cron] Game ${game.id} rounded up`);
      } catch (e) {
        console.error(`[Cron] Game ${game.id}:`, e);
      }
    }

    console.log(`[Cron] Roundup done: ${ranked} ranked, ${published} published`);
  } catch (e) {
    console.error("[Cron] Roundup failed:", e);
  }
}

/**
 * Start all cron jobs. Called once on server startup via instrumentation.ts.
 */
export function startCronJobs() {
  // Every 5 minutes: roundup unranked ended games
  cron.schedule("*/5 * * * *", roundupGames);
  console.log("[Cron] Scheduled: roundup-games (every 5 min)");
}
