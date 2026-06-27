import cron from "node-cron";
import { UserPlatform } from "@prisma";
import { processPendingPurchases } from "@/lib/game/pending-purchases";
import { sendTicketOpenNotifications } from "@/lib/game/ticket-open-notifications";
import { runGameRoundup } from "@/lib/game/roundup";
import { ensureTournamentGame } from "@/lib/player/tournamentGames";
import { closeLeagueSeason } from "@/lib/player/leagueSettlement";
import { env } from "@/lib/env";
import { sendDueTelegramGameStartedAnnouncements } from "@/lib/telegram/waffles-bot";

let cronJobsStarted = false;
let roundupRunning = false;

/**
 * Roundup ended games that haven't been settled yet. Finds games where
 * endsAt < now AND rankedAt is null, then ranks + publishes on-chain.
 */
async function roundupGames(source: string) {
  if (roundupRunning) {
    console.log("[Cron] Roundup skipped: previous run still active");
    return;
  }

  roundupRunning = true;
  try {
    const result = await runGameRoundup(source);
    console.log(
      `[Cron] Roundup done: ${result.ranked} ranked, ${result.published + result.republished} published, ${result.failed} failed`,
    );
    if (result.scheduledCreated > 0) {
      console.log(`[Cron] Auto-scheduled ${result.scheduledCreated} next game(s)`);
    }
  } catch (error) {
    console.error("[Cron] Roundup failed:", error);
  } finally {
    roundupRunning = false;
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

async function telegramGameStartedAnnouncementsJob() {
  try {
    const sent = await sendDueTelegramGameStartedAnnouncements();
    if (sent > 0) {
      console.log(`[Cron] Waffles Bot: ${sent} game start announcement(s) sent`);
    }
  } catch (e) {
    console.error("[Cron] Waffles Bot game start announcements failed:", e);
  }
}

/**
 * Ensure each platform has a live v2 tournament game (on-chain, with
 * questions). Idempotent — a no-op when the current window already has one.
 * Mirrors POST /api/cron/ensure-tournament-rounds.
 */
async function ensureTournamentRoundsJob() {
  const platforms = [UserPlatform.FARCASTER, UserPlatform.MINIPAY] as const;
  for (const platform of platforms) {
    try {
      const { created, gameId } = await ensureTournamentGame(platform);
      if (created) {
        console.log(`[Cron] Created tournament game ${gameId} (${platform})`);
      }
    } catch (e) {
      console.error(`[Cron] ensure-tournament-rounds failed (${platform}):`, e);
    }
  }
}

/**
 * Settle finished league seasons: rank each cohort, pay band rewards, and
 * promote/demote. Idempotent (per-cohort settledAt guard), so a daily run
 * self-heals — it closes last week's cohorts on the first run after rollover.
 */
async function closeLeagueSeasonJob() {
  try {
    const { cohorts, rewarded } = await closeLeagueSeason();
    if (cohorts > 0) {
      console.log(`[Cron] League settlement: ${cohorts} cohort(s) settled, ${rewarded} rewarded`);
    }
  } catch (e) {
    console.error("[Cron] League settlement failed:", e);
  }
}

/**
 * Start all cron jobs. Called once on server startup via instrumentation.ts.
 */
export function startCronJobs() {
  if (cronJobsStarted) {
    console.log("[Cron] Already scheduled");
    return;
  }

  if (!env.isProduction) {
    console.log("[Cron] Skipped: cron jobs only run in production");
    return;
  }

  cronJobsStarted = true;

  // Every 5 minutes: roundup unranked ended games
  cron.schedule("*/5 * * * *", () => {
    void roundupGames("node_cron");
  });
  console.log("[Cron] Scheduled: roundup-games (every 5 min)");
  void roundupGames("startup");

  // Every minute: retry pending purchase syncs
  cron.schedule("* * * * *", reconcilePendingPurchasesJob);
  console.log("[Cron] Scheduled: reconcile-pending-purchases (every min)");

  // Every minute: send ticket opening countdown notifications
  cron.schedule("* * * * *", ticketOpenNotificationsJob);
  console.log("[Cron] Scheduled: ticket-open-notifications (every min)");

  // Every minute: announce newly-live games to the configured Telegram group.
  cron.schedule("* * * * *", telegramGameStartedAnnouncementsJob);
  console.log("[Cron] Scheduled: telegram-game-started-announcements (every min)");
  telegramGameStartedAnnouncementsJob();

  // Every minute: ensure each platform has a live v2 tournament game. The
  // operation is idempotent, so frequent checks self-heal if the process misses
  // the exact window boundary during a restart, deploy, or blocked event loop.
  cron.schedule("* * * * *", ensureTournamentRoundsJob);
  console.log("[Cron] Scheduled: ensure-tournament-rounds (every min)");
  ensureTournamentRoundsJob();

  // Daily at 00:10 UTC: settle any finished league season (idempotent). Runs
  // once now too, to cover a restart on the day a week rolled over.
  cron.schedule("10 0 * * *", closeLeagueSeasonJob);
  console.log("[Cron] Scheduled: close-league-season (daily 00:10 UTC)");
  closeLeagueSeasonJob();
}
