/**
 * v2 leagues — seasonal tier ladder. Tier definitions live in `League`; per-user,
 * per-season standing in `LeagueMember`. A player's tier is derived from XP (the
 * progression proxy) until a dedicated league-points accrual exists. The screen
 * renders the static ladder and highlights the tier this returns as "current".
 */
import { prisma } from "@/lib/db";
import { LeagueTier } from "@prisma";

type TierDef = { tier: LeagueTier; key: string; label: string; color: string; minXp: number };

// Ordered low→high. `key` matches the screen's TIERS[].key.
export const LEAGUE_TIERS: TierDef[] = [
  { tier: LeagueTier.APPRENTICE_1, key: "apprentice1", label: "APPRENTICE I", color: "#cd7f32", minXp: 0 },
  { tier: LeagueTier.APPRENTICE_2, key: "apprentice2", label: "APPRENTICE II", color: "#cd7f32", minXp: 200 },
  { tier: LeagueTier.SILVER_1, key: "silver1", label: "SILVER I", color: "#bfc7d0", minXp: 500 },
  { tier: LeagueTier.SILVER_2, key: "silver2", label: "SILVER II", color: "#bfc7d0", minXp: 1000 },
  { tier: LeagueTier.SILVER_3, key: "silver3", label: "SILVER III", color: "#bfc7d0", minXp: 1800 },
  { tier: LeagueTier.ADVANCED_1, key: "advanced1", label: "ADVANCED I", color: "#9aa6b3", minXp: 3000 },
  { tier: LeagueTier.ADVANCED_2, key: "advanced2", label: "ADVANCED II", color: "#9aa6b3", minXp: 5000 },
  { tier: LeagueTier.GENIUS, key: "genius", label: "GENIUS", color: "#3ddbb8", minXp: 8000 },
  { tier: LeagueTier.MASTER_3, key: "master3", label: "MASTER III", color: "#FFC931", minXp: 12000 },
  { tier: LeagueTier.MASTER_2, key: "master2", label: "MASTER II", color: "#FFC931", minXp: 18000 },
  { tier: LeagueTier.MASTER_1, key: "master1", label: "MASTER I", color: "#FFC931", minXp: 25000 },
];

const TIER_BY_ENUM = new Map(LEAGUE_TIERS.map((t) => [t.tier, t]));

export function tierForXp(xp: number): TierDef {
  let chosen = LEAGUE_TIERS[0];
  for (const t of LEAGUE_TIERS) if (xp >= t.minXp) chosen = t;
  return chosen;
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

/** Seed/refresh the League tier rows (idempotent). */
export async function seedLeagues(): Promise<number> {
  for (let i = 0; i < LEAGUE_TIERS.length; i++) {
    const t = LEAGUE_TIERS[i];
    await prisma.league.upsert({
      where: { tier: t.tier },
      create: { tier: t.tier, label: t.label, color: t.color, sortOrder: i, rewards: {} },
      update: { label: t.label, color: t.color, sortOrder: i },
    });
  }
  return prisma.league.count();
}

export type V2League = { tier: string; key: string; label: string; color: string; points: number; season: string };

/** Resolve (and persist) the player's current-season tier from their XP. */
export async function loadLeague(userId: string): Promise<V2League> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xp: true } });
  const def = tierForXp(user.xp);
  const season = currentSeason();
  const league = await prisma.league.findUnique({ where: { tier: def.tier }, select: { id: true } });

  if (league) {
    await prisma.leagueMember.upsert({
      where: { userId_season: { userId, season } },
      create: { userId, season, leagueId: league.id, points: user.xp },
      update: { leagueId: league.id, points: user.xp },
    });
  }
  return { tier: def.tier, key: def.key, label: def.label, color: def.color, points: user.xp, season };
}

export function tierKeyForEnum(tier: LeagueTier): string {
  return TIER_BY_ENUM.get(tier)?.key ?? "apprentice1";
}
