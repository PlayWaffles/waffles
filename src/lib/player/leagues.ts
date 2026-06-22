/**
 * v2 leagues — seasonal tier ladder with weekly cohort competition. Tier
 * definitions live in `League`; per-user, per-season standing in `LeagueMember`,
 * grouped into `LeagueCohort` rooms of ~30. Season points accrue from games
 * played that week (see `accrueLeaguePoints`); a player's XP is the source of
 * truth for their current tier, and the season member is kept in that tier's
 * cohort.
 */
import { prisma } from "@/lib/db";
import { BoostKind, LeagueOutcome, LeagueTier, PowerUpKind, Prisma } from "@prisma";

type TierDef = { tier: LeagueTier; key: string; label: string; color: string; minXp: number };

// Ordered low→high. `key` matches the screen's TIERS[].key.
export const LEAGUE_TIERS: TierDef[] = [
  { tier: LeagueTier.APPRENTICE_1, key: "apprentice1", label: "APPRENTICE I", color: "#cd7f32", minXp: 0 },
  { tier: LeagueTier.APPRENTICE_2, key: "apprentice2", label: "APPRENTICE II", color: "#cd7f32", minXp: 5000 },
  { tier: LeagueTier.SILVER_1, key: "silver1", label: "SILVER I", color: "#bfc7d0", minXp: 15000 },
  { tier: LeagueTier.SILVER_2, key: "silver2", label: "SILVER II", color: "#bfc7d0", minXp: 35000 },
  { tier: LeagueTier.SILVER_3, key: "silver3", label: "SILVER III", color: "#bfc7d0", minXp: 65000 },
  { tier: LeagueTier.ADVANCED_1, key: "advanced1", label: "ADVANCED I", color: "#9aa6b3", minXp: 120000 },
  { tier: LeagueTier.ADVANCED_2, key: "advanced2", label: "ADVANCED II", color: "#9aa6b3", minXp: 200000 },
  { tier: LeagueTier.GENIUS, key: "genius", label: "GENIUS", color: "#3ddbb8", minXp: 320000 },
  { tier: LeagueTier.MASTER_3, key: "master3", label: "MASTER III", color: "#FFC931", minXp: 500000 },
  { tier: LeagueTier.MASTER_2, key: "master2", label: "MASTER II", color: "#FFC931", minXp: 750000 },
  { tier: LeagueTier.MASTER_1, key: "master1", label: "MASTER I", color: "#FFC931", minXp: 1100000 },
];

const TIER_BY_ENUM = new Map(LEAGUE_TIERS.map((t) => [t.tier, t]));

// Promotion/demotion reward ladder per tier. Each row is a finishing-rank band
// (rainbow = 1st, purple = 2nd–5th, brown = 6th–20th) granting syrup + power-ups
// (+ a DOUBLE_XP boost for the top bands). No tickets/coins are ever minted here.
// Keyed by tier key; seeded into League.rewards so the season-close job + UI both
// read the same DB-backed numbers.
export type RewardPowerUp = { kind: PowerUpKind; n: number };
export type RewardBoost = { kind: BoostKind; charges: number };
export type LeagueRewardRow = {
  r: "rainbow" | "purple" | "brown";
  syrup: number;
  powerUps: RewardPowerUp[];
  boost?: RewardBoost;
};

// Power-up / boost grants depend on the band only; syrup scales by tier (below).
const BAND_GRANTS: Record<"rainbow" | "purple" | "brown", Omit<LeagueRewardRow, "r" | "syrup">> = {
  rainbow: {
    powerUps: [{ kind: PowerUpKind.SHIELD, n: 1 }, { kind: PowerUpKind.FIFTY_FIFTY, n: 2 }],
    boost: { kind: BoostKind.DOUBLE_XP, charges: 3 },
  },
  purple: {
    powerUps: [{ kind: PowerUpKind.FIFTY_FIFTY, n: 1 }],
    boost: { kind: BoostKind.DOUBLE_XP, charges: 1 },
  },
  brown: { powerUps: [] },
};

// Syrup payout per tier per band [rainbow, purple, brown].
const SYRUP_BY_TIER: Record<string, [number, number, number]> = {
  apprentice1: [200, 50, 20],
  apprentice2: [300, 100, 40],
  silver1: [350, 150, 60],
  advanced1: [500, 200, 80],
  advanced2: [600, 250, 100],
  master3: [1000, 450, 180],
  master1: [1500, 600, 250],
};

export const LEAGUE_REWARDS: Record<string, LeagueRewardRow[]> = Object.fromEntries(
  Object.entries(SYRUP_BY_TIER).map(([key, [rainbow, purple, brown]]) => [
    key,
    [
      { r: "rainbow", syrup: rainbow, ...BAND_GRANTS.rainbow },
      { r: "purple", syrup: purple, ...BAND_GRANTS.purple },
      { r: "brown", syrup: brown, ...BAND_GRANTS.brown },
    ],
  ]),
);

/** Reward band for a 1-based finishing rank, or null outside the paid range. */
export function bandForRank(rank: number): LeagueRewardRow["r"] | null {
  if (rank === 1) return "rainbow";
  if (rank >= 2 && rank <= 5) return "purple";
  if (rank >= 6 && rank <= 20) return "brown";
  return null;
}

export function tierForXp(xp: number): TierDef {
  let chosen = LEAGUE_TIERS[0];
  for (const t of LEAGUE_TIERS) if (xp >= t.minXp) chosen = t;
  return chosen;
}

/** Epoch-ms at which the current ISO-week season ends (next Monday 00:00 UTC). */
export function seasonEndsAt(d = new Date()): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // 0 = Monday
  date.setUTCDate(date.getUTCDate() + (7 - dayNum));
  return date.getTime();
}

/** Current season key, e.g. "2026-W24" (ISO week). */
export function currentSeason(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Seed/refresh the League tier rows incl. the reward ladder (idempotent). */
export async function seedLeagues(): Promise<number> {
  for (let i = 0; i < LEAGUE_TIERS.length; i++) {
    const t = LEAGUE_TIERS[i];
    const rewards = LEAGUE_REWARDS[t.key] ?? [];
    await prisma.league.upsert({
      where: { tier: t.tier },
      create: { tier: t.tier, label: t.label, color: t.color, sortOrder: i, rewards },
      update: { label: t.label, color: t.color, sortOrder: i, rewards },
    });
  }
  return prisma.league.count();
}

export type LeagueTierInfo = { key: string; label: string; color: string; rewards: LeagueRewardRow[] };
export type League = {
  tier: string;
  key: string;
  label: string;
  color: string;
  points: number; // this season's accrued points (NOT lifetime XP)
  rank: number | null; // live 1-based standing within the player's cohort
  cohortSize: number; // how many players share the cohort
  season: string;
  seasonEndsAt: number;
  tiers: LeagueTierInfo[];
};

export type LeagueLeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  points: number;
  avatarId: string | null;
  pfpUrl: string | null;
  you: boolean;
};

export type LeagueLeaderboard = {
  key: string;
  label: string;
  color: string;
  rank: number | null;
  points: number;
  cohortSize: number;
  season: string;
  seasonEndsAt: number;
  standings: LeagueLeaderboardRow[];
  you: LeagueLeaderboardRow | null;
};

// Players compete in rooms of up to this many; a new room opens when full.
export const COHORT_SIZE = 30;

type SeasonMember = { id: string; leagueId: string; cohortId: string | null; points: number };

/** Shift a tier up (promoted) / down (demoted) / same, clamped to ladder ends. */
function shiftedTier(currentTier: LeagueTier, outcome: LeagueOutcome | null): LeagueTier {
  const i = LEAGUE_TIERS.findIndex((t) => t.tier === currentTier);
  if (i < 0) return LEAGUE_TIERS[0].tier;
  if (outcome === LeagueOutcome.PROMOTED) return LEAGUE_TIERS[Math.min(i + 1, LEAGUE_TIERS.length - 1)].tier;
  if (outcome === LeagueOutcome.DEMOTED) return LEAGUE_TIERS[Math.max(i - 1, 0)].tier;
  return currentTier;
}

/** Find an open (under-capacity) cohort for this tier+season, else open a new one. */
async function assignCohort(tx: Prisma.TransactionClient, leagueId: string, season: string): Promise<string> {
  const cohorts = await tx.leagueCohort.findMany({
    where: { leagueId, season },
    select: { id: true, index: true, _count: { select: { members: true } } },
    orderBy: { index: "asc" },
  });
  const open = cohorts.find((c) => c._count.members < COHORT_SIZE);
  if (open) return open.id;
  const nextIndex = cohorts.length ? Math.max(...cohorts.map((c) => c.index)) + 1 : 0;
  const created = await tx.leagueCohort.create({
    data: { leagueId, season, index: nextIndex },
    select: { id: true },
  });
  return created.id;
}

/** Resolve (creating if needed) the player's standing for `season`, assigning
 *  them to the cohort for their XP-derived tier. Returns null only if the League
 *  ladder hasn't been seeded. */
async function ensureSeasonMember(
  tx: Prisma.TransactionClient,
  userId: string,
  season: string,
): Promise<SeasonMember | null> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
  const desiredTier = tierForXp(user.xp).tier;
  const desiredLeague = await tx.league.findUnique({ where: { tier: desiredTier }, select: { id: true } });
  if (!desiredLeague) return null;

  const existing = await tx.leagueMember.findUnique({
    where: { userId_season: { userId, season } },
    select: { id: true, leagueId: true, cohortId: true, points: true },
  });
  if (existing) {
    if (existing.leagueId !== desiredLeague.id) {
      const cohortId = await assignCohort(tx, desiredLeague.id, season);
      await tx.leagueMember.update({
        where: { id: existing.id },
        data: { leagueId: desiredLeague.id, cohortId },
      });
      return { ...existing, leagueId: desiredLeague.id, cohortId };
    }
    if (existing.cohortId) return existing;
    // Backfill a cohort for a member that predates cohort assignment.
    const cohortId = await assignCohort(tx, existing.leagueId, season);
    await tx.leagueMember.update({ where: { id: existing.id }, data: { cohortId } });
    return { ...existing, cohortId };
  }

  const cohortId = await assignCohort(tx, desiredLeague.id, season);
  return tx.leagueMember.create({
    data: { userId, season, leagueId: desiredLeague.id, cohortId, points: 0 },
    select: { id: true, leagueId: true, cohortId: true, points: true },
  });
}

/** Credit `points` to the player's current-season standing (best-effort: a
 *  failure here must never break the game-completion flow that calls it).
 *  Creates the season membership + cohort assignment on first accrual. */
export async function accrueLeaguePoints(userId: string, points: number): Promise<void> {
  if (points <= 0) return;
  const season = currentSeason();
  try {
    await prisma.$transaction(async (tx) => {
      const member = await ensureSeasonMember(tx, userId, season);
      if (!member) return;
      await tx.leagueMember.update({
        where: { id: member.id },
        data: { points: { increment: points } },
      });
    });
  } catch (e) {
    console.error("[leagues] accrueLeaguePoints failed:", e);
  }
}

/** Load the player's current-season standing (tier, season points, live cohort
 *  rank) plus the full DB-backed tier ladder the Leagues + Compete screens render. */
export async function loadLeague(userId: string): Promise<League> {
  const season = currentSeason();
  const leagues = await prisma.league.findMany({ orderBy: { sortOrder: "asc" } });
  const rewardsByTier = new Map(leagues.map((l) => [l.tier, (l.rewards ?? []) as LeagueRewardRow[]]));

  let member: SeasonMember | null = null;
  try {
    member = await prisma.$transaction((tx) => ensureSeasonMember(tx, userId, season));
  } catch (e) {
    console.error("[leagues] loadLeague ensureSeasonMember failed:", e);
  }

  // Tier tracks the player's XP directly — XP is the single source of truth for
  // which tier you're in, so progression is never gated to one tier per week.
  // (Cohort points/rank below still drive the weekly competition + rewards.)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
  const def = tierForXp(user.xp);

  // Live 1-based rank within the cohort: count of cohort-mates outscoring me.
  let rank: number | null = null;
  let cohortSize = 0;
  if (member?.cohortId) {
    const [ahead, total] = await Promise.all([
      prisma.leagueMember.count({ where: { cohortId: member.cohortId, points: { gt: member.points } } }),
      prisma.leagueMember.count({ where: { cohortId: member.cohortId } }),
    ]);
    rank = ahead + 1;
    cohortSize = total;
  }

  const tiers: LeagueTierInfo[] = LEAGUE_TIERS.map((t) => ({
    key: t.key,
    label: t.label,
    color: t.color,
    rewards: rewardsByTier.get(t.tier) ?? LEAGUE_REWARDS[t.key] ?? [],
  }));

  return {
    tier: def.tier,
    key: def.key,
    label: def.label,
    color: def.color,
    points: member?.points ?? 0,
    rank,
    cohortSize,
    season,
    seasonEndsAt: seasonEndsAt(),
    tiers,
  };
}

export async function loadLeagueLeaderboard(userId: string, limit = 50): Promise<LeagueLeaderboard | null> {
  const league = await loadLeague(userId);
  const member = await prisma.leagueMember.findUnique({
    where: { userId_season: { userId, season: league.season } },
    select: { cohortId: true, points: true },
  });
  if (!member?.cohortId) {
    return {
      key: league.key,
      label: league.label,
      color: league.color,
      rank: league.rank,
      points: league.points,
      cohortSize: league.cohortSize,
      season: league.season,
      seasonEndsAt: league.seasonEndsAt,
      standings: [],
      you: null,
    };
  }

  const rows = await prisma.leagueMember.findMany({
    where: { cohortId: member.cohortId },
    orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
    take: limit,
    select: {
      userId: true,
      points: true,
      user: { select: { username: true, avatarId: true, pfpUrl: true } },
    },
  });
  const allRowsForRank = await prisma.leagueMember.findMany({
    where: { cohortId: member.cohortId },
    orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
    select: {
      userId: true,
      points: true,
      user: { select: { username: true, avatarId: true, pfpUrl: true } },
    },
  });

  const toRow = (row: (typeof allRowsForRank)[number], index: number): LeagueLeaderboardRow => ({
    rank: index + 1,
    userId: row.userId,
    name: row.user.username ?? "Player",
    points: row.points,
    avatarId: row.user.avatarId ?? null,
    pfpUrl: row.user.pfpUrl ?? null,
    you: row.userId === userId,
  });

  const ranked = allRowsForRank.map(toRow);
  const standings = rows.map((row) => ranked.find((rankedRow) => rankedRow.userId === row.userId) ?? toRow(row, 0));
  const you = ranked.find((row) => row.you) ?? null;

  return {
    key: league.key,
    label: league.label,
    color: league.color,
    rank: league.rank,
    points: league.points,
    cohortSize: league.cohortSize,
    season: league.season,
    seasonEndsAt: league.seasonEndsAt,
    standings,
    you,
  };
}

export function tierKeyForEnum(tier: LeagueTier): string {
  return TIER_BY_ENUM.get(tier)?.key ?? "apprentice1";
}

export type LeagueTierBadge = { key: string; label: string; color: string };
export type LeagueResult = {
  season: string;
  rank: number;
  cohortSize: number;
  outcome: LeagueOutcome;
  from: LeagueTierBadge;
  to: LeagueTierBadge;
  reward: LeagueRewardRow | null; // what the finishing rank earned, if any
};

function tierBadge(tier: LeagueTier): LeagueTierBadge {
  const def = TIER_BY_ENUM.get(tier) ?? LEAGUE_TIERS[0];
  return { key: def.key, label: def.label, color: def.color };
}

/** The player's most recent *settled* season result (rank, promotion/demotion,
 *  earned reward) — for the season-start "here's how you did" takeover. Returns
 *  null when they've never been settled. The client gates one-time display by
 *  season key (localStorage), so this always returns the latest result. */
export async function loadLeagueResult(userId: string): Promise<LeagueResult | null> {
  const member = await prisma.leagueMember.findFirst({
    where: { userId, season: { lt: currentSeason() }, outcome: { not: null }, rank: { not: null } },
    orderBy: { season: "desc" },
    select: {
      season: true,
      rank: true,
      outcome: true,
      cohortId: true,
      league: { select: { tier: true, rewards: true } },
    },
  });
  if (!member || member.rank == null || member.outcome == null) return null;

  const fromTier = member.league.tier;
  const cohortSize = member.cohortId
    ? await prisma.leagueMember.count({ where: { cohortId: member.cohortId } })
    : 0;
  const band = bandForRank(member.rank);
  const rewards = (Array.isArray(member.league.rewards) ? member.league.rewards : []) as LeagueRewardRow[];
  const reward = band ? rewards.find((r) => r.r === band) ?? null : null;

  return {
    season: member.season,
    rank: member.rank,
    cohortSize,
    outcome: member.outcome,
    from: tierBadge(fromTier),
    to: tierBadge(shiftedTier(fromTier, member.outcome)),
    reward,
  };
}
