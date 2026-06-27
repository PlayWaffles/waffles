/**
 * Levels leaderboard — ranks players by total XP (the single persisted
 * progression metric, `User.xp`). The displayed "level" is derived from XP using
 * the same rollover the Home XP bar uses, so the board and the bar always agree.
 *
 * Separate from the tournament boards (tournamentGames.ts): those rank paid
 * on-chain game score/winnings; this ranks free solo-progression XP. Platform-
 * scoped (XP is global per user, but boards never mix MiniPay/Farcaster fields).
 */
import { prisma } from "@/lib/db";
import { LevelTrack, type UserPlatform } from "@prisma";

const TRACK_TO_ENUM = {
  standard: LevelTrack.STANDARD,
  "world-cup": LevelTrack.WORLD_CUP,
} as const;

export type LeaderboardTrack = keyof typeof TRACK_TO_ENUM;

// Mirrors the Home XP bar rollover (see XP_PER_LEVEL in screens/home.tsx). Kept
// here so the server-derived level matches what the player sees client-side.
export const XP_PER_LEVEL = 500;

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export type LevelStanding = {
  rank: number;
  userId: string;
  name: string;
  xp: number;
  level: number;
  you: boolean;
};

export type LevelBoard = {
  fieldSize: number;
  standings: LevelStanding[];
  you: LevelStanding | null;
};

/** Top players by total XP for a platform, plus the caller's own true rank
 *  (resolved even when they fall outside the top `limit`).
 *
 *  When `opts.track` is set the board instead ranks players by how far they've
 *  climbed *that* practice campaign (LevelProgress.level), with global XP as the
 *  tiebreaker and display metric. Only players past level 1 (cleared at least one
 *  level) appear. */
export async function levelsLeaderboard(
  platform: UserPlatform,
  opts: { userId?: string; limit?: number; track?: LeaderboardTrack } = {},
): Promise<LevelBoard> {
  const limit = opts.limit ?? 50;

  if (opts.track) return trackLeaderboard(platform, opts.track, { userId: opts.userId, limit });

  const top = await prisma.user.findMany({
    where: { platform, xp: { gt: 0 } },
    orderBy: { xp: "desc" },
    take: limit,
    select: { id: true, username: true, xp: true },
  });

  const toStanding = (
    u: { id: string; username: string | null; xp: number },
    rank: number,
  ): LevelStanding => ({
    rank,
    userId: u.id,
    name: u.username ?? "Player",
    xp: u.xp,
    level: levelFromXp(u.xp),
    you: !!opts.userId && opts.userId === u.id,
  });

  const standings = top.map((u, i) => toStanding(u, i + 1));

  // Caller's own row: present in the top slice, else resolve their global rank
  // by counting everyone strictly ahead of them.
  let you: LevelStanding | null = standings.find((s) => s.you) ?? null;
  if (!you && opts.userId) {
    const me = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { id: true, username: true, xp: true },
    });
    if (me && me.xp > 0) {
      const ahead = await prisma.user.count({ where: { platform, xp: { gt: me.xp } } });
      you = toStanding(me, ahead + 1);
    }
  }

  const fieldSize = await prisma.user.count({ where: { platform, xp: { gt: 0 } } });
  return { fieldSize, standings, you };
}

/** Per-track campaign board: ranked by LevelProgress.level (desc), then global XP
 *  (desc) as the tiebreaker. Levels are coarse, so the XP tiebreak keeps ordering
 *  stable within a level and gives each row a granular metric to display. */
async function trackLeaderboard(
  platform: UserPlatform,
  track: LeaderboardTrack,
  opts: { userId?: string; limit: number },
): Promise<LevelBoard> {
  const trackEnum = TRACK_TO_ENUM[track];
  // Only surface players who've cleared at least one level (everyone is seeded at
  // level 1), so a fresh board isn't a wall of tied level-1 rows.
  const where = { track: trackEnum, level: { gt: 1 }, user: { platform } };

  const top = await prisma.levelProgress.findMany({
    where,
    orderBy: [{ level: "desc" }, { user: { xp: "desc" } }],
    take: opts.limit,
    select: { userId: true, level: true, user: { select: { username: true, xp: true } } },
  });

  const toStanding = (
    p: { userId: string; level: number; user: { username: string | null; xp: number } },
    rank: number,
  ): LevelStanding => ({
    rank,
    userId: p.userId,
    name: p.user.username ?? "Player",
    xp: p.user.xp,
    level: p.level,
    you: !!opts.userId && opts.userId === p.userId,
  });

  const standings = top.map((p, i) => toStanding(p, i + 1));

  // Caller's own row: present in the top slice, else resolve their true rank by
  // counting everyone strictly ahead under the same (level desc, xp desc) order.
  let you: LevelStanding | null = standings.find((s) => s.you) ?? null;
  if (!you && opts.userId) {
    const me = await prisma.levelProgress.findUnique({
      where: { userId_track: { userId: opts.userId, track: trackEnum } },
      select: { userId: true, level: true, user: { select: { username: true, xp: true } } },
    });
    if (me && me.level > 1) {
      const aheadByLevel = await prisma.levelProgress.count({
        where: { ...where, level: { gt: me.level } },
      });
      const aheadAtLevel = await prisma.levelProgress.count({
        where: { ...where, level: me.level, user: { platform, xp: { gt: me.user.xp } } },
      });
      you = toStanding(me, aheadByLevel + aheadAtLevel + 1);
    }
  }

  const fieldSize = await prisma.levelProgress.count({ where });
  return { fieldSize, standings, you };
}
