import cron from "node-cron";
import { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { rankGame, publishResults, sendResultNotifications } from "@/lib/game/lifecycle";
import { processPendingPurchases } from "@/lib/game/pending-purchases";
import { sendTicketOpenNotifications } from "@/lib/game/ticket-open-notifications";
import { ensureNextAutoScheduledGames } from "@/lib/game/auto-schedule";
import { ensureTournamentGame } from "@/lib/player/tournamentGames";
import { closeLeagueSeason } from "@/lib/player/leagueSettlement";
import { env } from "@/lib/env";

let cronJobsStarted = false;

/**
 * Roundup ended games that haven't been settled yet. Finds games where
 * endsAt < now AND rankedAt is null, then ranks + publishes on-chain.
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
 * Ensure each platform has a live v2 tournament game (on-chain, with
 * questions). Idempotent — a no-op when the current window already has one.
 * Mirrors POST /api/cron/ensure-tournament-rounds.
 */
async function ensureTournamentRoundsJob() {
  const platforms = [UserPlatform.FARCASTER, UserPlatform.MINIPAY] as const;
  let anyCreated = false;
  for (const platform of platforms) {
    try {
      const { created, gameId } = await ensureTournamentGame(platform);
      if (created) {
        anyCreated = true;
        console.log(`[Cron] Created tournament game ${gameId} (${platform})`);
      }
    } catch (e) {
      console.error(`[Cron] ensure-tournament-rounds failed (${platform}):`, e);
    }
  }

  // A new round just opened → push one in-app realtime toast to everyone
  // currently in the app. Both platforms run on the same hourly cadence, so
  // generic copy + a Home CTA always resolves to the caller's own live round.
  // Best-effort: a PartyKit/env failure must not break the cron tick.
  if (anyCreated) {
    try {
      const { deliverGlobalAnnouncement } = await import("@/lib/realtime/announcementDelivery");
      const now = Date.now();
      await deliverGlobalAnnouncement({
        id: `live:round-${Math.floor(now / 60_000)}`,
        priority: 90,
        tone: "maple",
        emoji: "🔴",
        title: "A new round just went live",
        body: "Jump in, answer 6, and play for the pot.",
        cta: { label: "Join the round", screen: "home" },
        publishedAt: now,
        startsAt: 0,
        endsAt: now + 60 * 60 * 1000,
        ephemeral: true,
      });
    } catch (e) {
      console.error("[Cron] round-live realtime toast failed:", e);
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
  cron.schedule("*/5 * * * *", roundupGames);
  console.log("[Cron] Scheduled: roundup-games (every 5 min)");

  // Every minute: retry pending purchase syncs
  cron.schedule("* * * * *", reconcilePendingPurchasesJob);
  console.log("[Cron] Scheduled: reconcile-pending-purchases (every min)");

  // Every minute: send ticket opening countdown notifications
  cron.schedule("* * * * *", ticketOpenNotificationsJob);
  console.log("[Cron] Scheduled: ticket-open-notifications (every min)");

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
