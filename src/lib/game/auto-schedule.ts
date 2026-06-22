import { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { createAutoScheduledGame } from "@/lib/game/auto-create";

const ONE_HOUR_MS = 60 * 60 * 1000;
// Default spots (entry cap) for an auto-scheduled game. Set here rather than
// carried forward so the cap is a deliberate default, not whatever the last
// game happened to use.
const DEFAULT_MAX_PLAYERS = 50;

// Continuous hourly cadence: a new 1-hour game starts the moment the last one
// ends, back-to-back, 24/7 (no weekday/time gating). Kept back-to-back even if
// `now` is a touch past that end (cron ran a beat late) so there's no gap, as
// long as the resulting hour-long game would still be ongoing. If a whole hour
// or more was missed, re-align to the top of the current hour so a fresh game
// covers `now`.
export function getNextAutoGameStart(lastEndsAt: Date, now = new Date()) {
  if (lastEndsAt.getTime() + ONE_HOUR_MS > now.getTime()) {
    return new Date(lastEndsAt);
  }
  const aligned = new Date(now);
  aligned.setUTCMinutes(0, 0, 0);
  return aligned;
}

interface ScheduleSeed {
  startsAt: Date;
  endsAt: Date;
  ticketsOpenAt: Date | null;
}

export function buildNextAutoGameSchedule(seed: ScheduleSeed, now = new Date()) {
  const nextStartsAt = getNextAutoGameStart(seed.endsAt, now);
  const nextEndsAt = new Date(nextStartsAt.getTime() + ONE_HOUR_MS);

  let nextTicketsOpenAt: Date | null = null;
  if (seed.ticketsOpenAt) {
    const leadMs = seed.startsAt.getTime() - seed.ticketsOpenAt.getTime();
    if (leadMs > 0) {
      const candidate = new Date(nextStartsAt.getTime() - leadMs);
      nextTicketsOpenAt = candidate.getTime() > now.getTime() ? candidate : null;
    }
  }

  return {
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    ticketsOpenAt: nextTicketsOpenAt,
  };
}

export async function ensureNextAutoScheduledGameForPlatform(platform: UserPlatform) {
  const now = new Date();

  const liveOrUpcoming = await prisma.game.findFirst({
    where: {
      platform,
      endsAt: { gt: now },
    },
    select: { id: true },
  });

  if (liveOrUpcoming) {
    return { created: false as const, reason: "existing_live_or_upcoming" as const };
  }

  const latestEndedGame = await prisma.game.findFirst({
    where: {
      platform,
      endsAt: { lte: now },
    },
    orderBy: { endsAt: "desc" },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      ticketsOpenAt: true,
      tierPrices: true,
      roundBreakSec: true,
      maxPlayers: true,
    },
  });

  if (!latestEndedGame) {
    return { created: false as const, reason: "no_completed_game" as const };
  }

  const schedule = buildNextAutoGameSchedule(
    {
      startsAt: latestEndedGame.startsAt,
      endsAt: latestEndedGame.endsAt,
      ticketsOpenAt: latestEndedGame.ticketsOpenAt,
    },
    now,
  );

  const alreadyScheduled = await prisma.game.findFirst({
    where: {
      platform,
      startsAt: { gte: now },
    },
    select: { id: true },
  });

  if (alreadyScheduled) {
    return { created: false as const, reason: "already_scheduled" as const };
  }

  const created = await createAutoScheduledGame({
    platform,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    ticketsOpenAt: schedule.ticketsOpenAt,
    ticketPrice: latestEndedGame.tierPrices[0] ?? 1,
    roundBreakSec: latestEndedGame.roundBreakSec,
    maxPlayers: DEFAULT_MAX_PLAYERS,
  });

  return {
    created: true as const,
    gameId: created.gameId,
    gameNumber: created.gameNumber,
  };
}

export async function ensureNextAutoScheduledGames() {
  const platforms = [
    UserPlatform.FARCASTER,
    UserPlatform.MINIPAY,
  ] as const;
  const results = [];

  for (const platform of platforms) {
    try {
      const result = await ensureNextAutoScheduledGameForPlatform(platform);
      results.push({ platform, ...result });
    } catch (error) {
      console.error("[auto-schedule] failed", {
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
      results.push({ platform, created: false as const, reason: "error" as const });
    }
  }

  return results;
}
