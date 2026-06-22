/**
 * v2 daily missions — backed by the existing Quest / QuestProgress / CompletedQuest
 * models. Missions are `Quest` rows (category ENGAGEMENT, repeatFrequency DAILY);
 * per-user progress lives in `QuestProgress`. A mission becomes *claimable* once
 * progress reaches `requiredCount`; the player then explicitly claims it, which
 * (re)writes the `CompletedQuest` row and awards XP. So `CompletedQuest` means
 * "claimed" (not merely "reached"). The partner-offer tab stays static.
 *
 * TWO GROUPS —
 *  - FEATURED (`Quest.featured = true`): the small fixed set pinned to the Home
 *    card (the "3 dailies"). Always active.
 *  - GENERATED (the rest of the active ENGAGEMENT/DAILY quests = the pool): each
 *    UTC day a deterministic, global slice of `GENERATED_PER_DAY` is surfaced on
 *    the Missions page. The pick is a pure function of the date (same for every
 *    player, stable all day, fresh at UTC midnight) — no cron, no stored picks.
 *
 * DAILY RESET — there is no reset cron. Each read/write is scoped to the current
 * UTC day via timestamps (`QuestProgress.updatedAt`, `CompletedQuest.completedAt`):
 * progress or a claim from a *previous* UTC day is treated as stale (count 0 /
 * unclaimed), so missions come back each day. The single per-(user,quest) rows
 * are overwritten in place rather than accumulating one row per day.
 *
 * EVENT-DRIVEN PROGRESS — missions advance by `Quest.eventType` (the gameplay
 * signal, e.g. "questions_answered"), so a single `recordMissionEvent` hook
 * advances every active mission keyed to that signal. The "day_streak" event is
 * *derived* from the login streak, never counted — so it's claimable on any day
 * the player is on a long-enough streak.
 */
import { prisma } from "@/lib/db";
import { resolveLoginStreak } from "@/lib/player/dailyStreak";
import { QuestCategory, RepeatFrequency } from "@prisma";

// How many pool missions the Missions page surfaces per day (global, deterministic).
const GENERATED_PER_DAY = 4;

// Event types whose progress is derived from existing state rather than counted
// from emitted events, so `recordMissionEvent` never writes a counter for them.
const DERIVED_EVENT_TYPES = new Set<string>(["day_streak"]);

export type Mission = {
  slug: string;
  title: string;
  count: number; // current progress
  total: number; // requiredCount
  xp: number;
  done: boolean; // claimed (XP awarded)
  claimable: boolean; // reached requiredCount but not yet claimed
  icon: string; // client asset key (mapped in the screen)
  featured: boolean; // pinned home daily vs part of the generated set
};

export type ClaimMissionResult =
  | { ok: true; xpAwarded: number; xp: number }
  | { ok: false; error: "not_found" | "not_complete" | "already_claimed" };

// Asset key per mission slug (the screen maps these to ASSETS.*); falls back to
// an icon per event type, then a default, so pool missions always have art.
const ICON_BY_SLUG: Record<string, string> = {
  "daily-answer-5": "iconTarget",
  "daily-streak-10": "flame",
  "daily-answer-3": "iconTarget",
  "daily-win-tournament": "trophy",
  "daily-play-5-days": "iconCalendar",
};
const ICON_BY_EVENT: Record<string, string> = {
  questions_answered: "iconTarget",
  correct_answers: "iconTarget",
  tournaments_played: "trophy",
  tournaments_won: "trophy",
  points_scored: "flame",
  games_played: "iconCalendar",
  day_streak: "iconCalendar",
};
const resolveIcon = (slug: string, eventType: string | null): string =>
  ICON_BY_SLUG[slug] ?? (eventType ? ICON_BY_EVENT[eventType] : undefined) ?? "iconTarget";

// --- day / selection helpers ------------------------------------------------

/** Start of the current UTC day — the boundary a mission's daily progress and
 *  claim are scoped to. */
const startOfUtcDay = (now = new Date()): Date => {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/** Calendar key ("YYYY-MM-DD") for the current UTC day — the generation seed. */
const dateKeyUtc = (now = new Date()): string => new Date(now).toISOString().slice(0, 10);

// FNV-1a string hash → uint32, used to seed the daily shuffle.
const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Deterministic Fisher–Yates using a mulberry32 PRNG seeded by `seed`, so the
// same seed always yields the same order (the basis of the global daily pick).
const seededShuffle = <T>(items: T[], seed: number): T[] => {
  const a = [...items];
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Today's generated slice of the pool — deterministic and identical for every
 *  player. Stable id-order first so the shuffle input doesn't depend on DB row
 *  ordering. */
const pickDailyGenerated = <T extends { id: string }>(pool: T[], dateKey: string, n: number): T[] => {
  const ordered = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  return seededShuffle(ordered, hashStr(dateKey)).slice(0, n);
};

type QuestRow = {
  id: string;
  slug: string;
  title: string;
  points: number;
  requiredCount: number;
  eventType: string | null;
  featured: boolean;
};

const activeDailyQuests = (): Promise<QuestRow[]> =>
  prisma.quest.findMany({
    where: { category: QuestCategory.ENGAGEMENT, repeatFrequency: RepeatFrequency.DAILY, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, title: true, points: true, requiredCount: true, eventType: true, featured: true },
  });

/** The featured dailies plus today's generated slice — the set actually live for
 *  a player right now (featured first, then the generated picks). */
const activeMissionsToday = (quests: QuestRow[]): QuestRow[] => {
  const featured = quests.filter((q) => q.featured);
  const pool = quests.filter((q) => !q.featured);
  const generated = pickDailyGenerated(pool, dateKeyUtc(), GENERATED_PER_DAY);
  return [...featured, ...generated];
};

// --- public API -------------------------------------------------------------

export async function loadMissions(userId: string): Promise<Mission[]> {
  const quests = await activeDailyQuests();
  if (quests.length === 0) return [];

  const active = activeMissionsToday(quests);
  const ids = active.map((q) => q.id);
  const dayStart = startOfUtcDay();

  const [progress, completed, user] = await Promise.all([
    prisma.questProgress.findMany({
      where: { userId, questId: { in: ids } },
      select: { questId: true, count: true, updatedAt: true },
    }),
    prisma.completedQuest.findMany({
      where: { userId, questId: { in: ids } },
      select: { questId: true, completedAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, bestStreak: true, lastLoginAt: true },
    }),
  ]);
  // Only count progress / claims from the current UTC day — older is stale.
  const countById = new Map(
    progress.filter((p) => p.updatedAt >= dayStart).map((p) => [p.questId, p.count]),
  );
  const doneSet = new Set(
    completed.filter((c) => c.completedAt >= dayStart).map((c) => c.questId),
  );
  const streak = user ? resolveLoginStreak(user).currentStreak : 0;

  return active.map((q) => {
    const claimed = doneSet.has(q.id);
    // Derived (streak) missions read the day-streak; the rest read the counter.
    const rawCount =
      q.eventType === "day_streak"
        ? Math.min(streak, q.requiredCount)
        : Math.min(countById.get(q.id) ?? 0, q.requiredCount);
    const claimable = !claimed && rawCount >= q.requiredCount;
    return {
      slug: q.slug,
      title: q.title,
      count: claimed ? q.requiredCount : rawCount,
      total: q.requiredCount,
      xp: q.points,
      done: claimed,
      claimable,
      icon: resolveIcon(q.slug, q.eventType),
      featured: q.featured,
    };
  });
}

// Advance one quest's same-day counter (the shared daily-window upsert).
async function advanceQuest(
  userId: string,
  questId: string,
  requiredCount: number,
  n: number,
  dayStart: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const already = await tx.completedQuest.findUnique({
      where: { userId_questId: { userId, questId } },
      select: { completedAt: true },
    });
    if (already && already.completedAt >= dayStart) return; // already claimed today

    const prog = await tx.questProgress.findUnique({
      where: { userId_questId: { userId, questId } },
      select: { count: true, updatedAt: true },
    });
    // Fresh day (or first ever) starts the count over; same day accumulates.
    const base = prog && prog.updatedAt >= dayStart ? prog.count : 0;
    const nextCount = Math.min(base + n, requiredCount);

    await tx.questProgress.upsert({
      where: { userId_questId: { userId, questId } },
      create: { userId, questId, count: nextCount },
      update: { count: nextCount },
    });
  });
}

/**
 * Record a gameplay event for a user, advancing every mission *active today*
 * (featured + today's generated slice) keyed to that `eventType`. Derived event
 * types (e.g. day_streak) are ignored — their progress isn't counted. Scoped to
 * the current UTC day. Best-effort; called from gameplay/settlement hooks.
 */
export async function recordMissionEvent(userId: string, eventType: string, n = 1): Promise<void> {
  if (!eventType || DERIVED_EVENT_TYPES.has(eventType)) return;

  const quests = await activeDailyQuests();
  if (quests.length === 0) return;
  const activeIds = new Set(activeMissionsToday(quests).map((q) => q.id));
  const targets = quests.filter((q) => q.eventType === eventType && activeIds.has(q.id));
  if (targets.length === 0) return;

  const dayStart = startOfUtcDay();
  for (const q of targets) {
    await advanceQuest(userId, q.id, q.requiredCount, n, dayStart);
  }
}

/**
 * Claim a completed mission for the current UTC day: (re)writes the
 * `CompletedQuest` row and awards XP. A claim from a previous day is overwritten,
 * so the mission can be claimed again once it's re-completed on a new day. Guards
 * against claiming an incomplete or already-claimed-today mission.
 */
export async function claimMission(userId: string, slug: string): Promise<ClaimMissionResult> {
  const quest = await prisma.quest.findUnique({
    where: { slug },
    select: { id: true, requiredCount: true, points: true, eventType: true },
  });
  if (!quest) return { ok: false, error: "not_found" };

  const dayStart = startOfUtcDay();
  return prisma.$transaction(async (tx): Promise<ClaimMissionResult> => {
    const already = await tx.completedQuest.findUnique({
      where: { userId_questId: { userId, questId: quest.id } },
      select: { completedAt: true },
    });
    if (already && already.completedAt >= dayStart) return { ok: false, error: "already_claimed" };

    // Today's progress: derived (streak) missions read the day-streak; the rest
    // read the same-day counter.
    let todayCount: number;
    if (quest.eventType === "day_streak") {
      const u = await tx.user.findUnique({
        where: { id: userId },
        select: { currentStreak: true, bestStreak: true, lastLoginAt: true },
      });
      todayCount = u ? resolveLoginStreak(u).currentStreak : 0;
    } else {
      const prog = await tx.questProgress.findUnique({
        where: { userId_questId: { userId, questId: quest.id } },
        select: { count: true, updatedAt: true },
      });
      todayCount = prog && prog.updatedAt >= dayStart ? prog.count : 0;
    }
    if (todayCount < quest.requiredCount) return { ok: false, error: "not_complete" };

    // Overwrite any prior-day claim so the single row tracks today's claim.
    await tx.completedQuest.upsert({
      where: { userId_questId: { userId, questId: quest.id } },
      create: { userId, questId: quest.id, pointsAwarded: quest.points },
      update: { completedAt: new Date(), pointsAwarded: quest.points },
    });
    const updated = await tx.user.update({
      where: { id: userId },
      data: { xp: { increment: quest.points } },
      select: { xp: true },
    });
    return { ok: true, xpAwarded: quest.points, xp: updated.xp };
  });
}
