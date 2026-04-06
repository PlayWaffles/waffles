import { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { createAutoScheduledGame } from "@/lib/game/auto-create";

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * ONE_HOUR_MS;
const ALLOWED_WEEKDAYS = new Set([1, 3, 5]); // Mon, Wed, Fri in Africa/Lagos
const AUTO_START_HOUR_UTC = 14;

export function getNextAutoGameStart(lastEndsAt: Date, now = new Date()) {
  const earliestStart = new Date(lastEndsAt.getTime() + ONE_HOUR_MS);
  const candidate = new Date(earliestStart);
  candidate.setUTCHours(AUTO_START_HOUR_UTC, 0, 0, 0);

  if (candidate.getTime() < earliestStart.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  while (
    !ALLOWED_WEEKDAYS.has(candidate.getUTCDay()) ||
    candidate.getTime() <= now.getTime()
  ) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
    candidate.setUTCHours(AUTO_START_HOUR_UTC, 0, 0, 0);
  }

  return candidate;
}

interface ScheduleSeed {
  startsAt: Date;
  endsAt: Date;
  ticketsOpenAt: Date | null;
}

export function buildNextAutoGameSchedule(seed: ScheduleSeed, now = new Date()) {
  const nextStartsAt = getNextAutoGameStart(seed.endsAt, now);
  const nextEndsAt = new Date(nextStartsAt.getTime() + TWO_HOURS_MS);

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
    maxPlayers: latestEndedGame.maxPlayers,
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
