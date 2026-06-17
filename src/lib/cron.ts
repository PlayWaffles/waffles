import cron from "node-cron";
import { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { rankGame, publishResults, sendResultNotifications } from "@/lib/game/lifecycle";
import { processPendingPurchases } from "@/lib/game/pending-purchases";
import { sendTicketOpenNotifications } from "@/lib/game/ticket-open-notifications";
import { ensureNextAutoScheduledGames } from "@/lib/game/auto-schedule";
import { ensureHourlyTournamentGame } from "@/lib/v2/tournamentGames";

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

    // Retry publish for games that were ranked but never published on-chain
    // (e.g. a prior publish threw — settler out of gas, RPC blip). Without this,
    // a winner's prize is stuck un-claimable forever. Self-heals once fixable.
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
    let republished = 0;
    for (const game of stuck) {
      try {
        await publishResults(game.id);
        republished++;
        console.log(`[Cron] Re-published stuck game ${game.id}`);
      } catch (e) {
        console.error(`[Cron] Re-publish failed for ${game.id}:`, e);
      }
    }

    console.log(`[Cron] Roundup done: ${ranked} ranked, ${published + republished} published`);

    const scheduled = await ensureNextAutoScheduledGames();
    const created = scheduled.filter((result) => result.created).length;
    if (created > 0) {
      console.log(`[Cron] Auto-scheduled ${created} next game(s)`);
    }
  } catch (e) {
    console.error("[Cron] Roundup failed:", e);
  }
}

async function reconcilePendingPurchasesJob() {
  try {
    const result = await processPendingPurchases(25);
    if (result.processed > 0) {
      console.log(
        `[Cron] Pending purchases: ${result.processed} processed, ${result.synced} synced, ${result.failed} failed`,
      );
    }
  } catch (e) {
    console.error("[Cron] Pending purchase reconcile failed:", e);
  }
}

async function ticketOpenNotificationsJob() {
  try {
    await sendTicketOpenNotifications();
  } catch (e) {
    console.error("[Cron] Ticket open notifications failed:", e);
  }
}

/**
 * Ensure each platform has a live hourly v2 tournament game (on-chain, with
 * questions). Idempotent — a no-op when the current hour already has one.
 * Mirrors POST /api/cron/ensure-tournament-rounds.
 */
async function ensureTournamentRoundsJob() {
  const platforms = [UserPlatform.FARCASTER, UserPlatform.MINIPAY] as const;
  for (const platform of platforms) {
    try {
      const { created, gameId } = await ensureHourlyTournamentGame(platform);
      if (created) {
        console.log(`[Cron] Created hourly tournament game ${gameId} (${platform})`);
      }
    } catch (e) {
      console.error(`[Cron] ensure-tournament-rounds failed (${platform}):`, e);
    }
  }
}

/**
 * Start all cron jobs. Called once on server startup via instrumentation.ts.
 */
export function startCronJobs() {
  // Every 5 minutes: roundup unranked ended games
  cron.schedule("*/5 * * * *", roundupGames);
  console.log("[Cron] Scheduled: roundup-games (every 5 min)");

  // Every minute: retry pending purchase syncs
  cron.schedule("* * * * *", reconcilePendingPurchasesJob);
  console.log("[Cron] Scheduled: reconcile-pending-purchases (every min)");

  // Every minute: send ticket opening countdown notifications
  cron.schedule("* * * * *", ticketOpenNotificationsJob);
  console.log("[Cron] Scheduled: ticket-open-notifications (every min)");

  // Top of every hour: ensure each platform has a live v2 tournament game.
  // Idempotent, so also run once now to cover mid-hour restarts.
  cron.schedule("0 * * * *", ensureTournamentRoundsJob);
  console.log("[Cron] Scheduled: ensure-tournament-rounds (hourly)");
  ensureTournamentRoundsJob();
}
