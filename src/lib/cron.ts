import cron from "node-cron";
import { UserPlatform } from "@prisma";
import { sendTicketOpenNotifications } from "@/lib/game/ticket-open-notifications";
import { runGameRoundup } from "@/lib/game/roundup";
import { ensureTournamentGame } from "@/lib/player/tournamentGames";
import { closeLeagueSeason } from "@/lib/player/leagueSettlement";
import { env } from "@/lib/env";
import { sendDueTelegramGameStartedAnnouncements } from "@/lib/telegram/waffles-bot";

let cronJobsStarted = false;
let roundupRunning = false;

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
  } catch (error) {
    console.error("[Cron] Roundup failed:", error);
  } finally {
    roundupRunning = false;
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

  cron.schedule("*/5 * * * *", () => {
    void roundupGames("node_cron");
  });
  console.log("[Cron] Scheduled: roundup-games (every 5 min)");
  void roundupGames("startup");

  cron.schedule("* * * * *", ticketOpenNotificationsJob);
  console.log("[Cron] Scheduled: ticket-open-notifications (every min)");

  cron.schedule("* * * * *", telegramGameStartedAnnouncementsJob);
  console.log("[Cron] Scheduled: telegram-game-started-announcements (every min)");
  telegramGameStartedAnnouncementsJob();

  cron.schedule("* * * * *", ensureTournamentRoundsJob);
  console.log("[Cron] Scheduled: ensure-tournament-rounds (every min)");
  ensureTournamentRoundsJob();

  cron.schedule("10 0 * * *", closeLeagueSeasonJob);
  console.log("[Cron] Scheduled: close-league-season (daily 00:10 UTC)");
  closeLeagueSeasonJob();
}