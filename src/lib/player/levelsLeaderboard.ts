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
import type { UserPlatform } from "@prisma";

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
 *  (resolved even when they fall outside the top `limit`). */
export async function levelsLeaderboard(
  platform: UserPlatform,
  opts: { userId?: string; limit?: number } = {},
): Promise<LevelBoard> {
  const limit = opts.limit ?? 50;

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
