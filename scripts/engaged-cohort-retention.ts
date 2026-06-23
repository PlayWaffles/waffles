/**
 * Read-only: for MiniPay tournament players, measure which retention LOOPS the
 * engaged (repeat) cohort is actually in vs the one-timers — and whether the
 * "engaged" are themselves still active or quietly drifting.
 *
 *   node --env-file=.env --import tsx scripts/engaged-cohort-retention.ts
 */
import { prisma } from "@/lib/db";
import { UserPlatform } from "@prisma";

const TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS ?? 120_000);
const CHUNK = 1_000;
const DAY = 86_400_000;
const chunk = <T,>(a: T[], n: number): T[][] => {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
};
const pct = (c: number, d: number) => (d ? ((100 * c) / d).toFixed(1) : "0.0") + "%";
const med = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

type P = {
  userId: string;
  entries: number;
  lastEntry: number;
  currentStreak: number;
  bestStreak: number;
  lastLoginAt: number | null;
  dailyClaims: number;
  missionsDone: number;
  leaguePoints: number;
  inLeague: boolean;
};

async function main() {
  const now = Date.now();
  const grouped = await prisma.gameEntry.groupBy({
    by: ["userId"],
    where: { paidAt: { not: null }, game: { platform: UserPlatform.MINIPAY, onchainId: { not: null } } },
    _count: { _all: true },
    _max: { paidAt: true },
  });
  const ids = grouped.map((g) => g.userId);

  const usr = new Map<string, { cs: number; bs: number; ll: number | null }>();
  const dailyCt = new Map<string, number>();
  const missionCt = new Map<string, number>();
  const league = new Map<string, number>();

  for (const batch of chunk(ids, CHUNK)) {
    const [users, daily, missions, members] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: batch } },
        select: { id: true, currentStreak: true, bestStreak: true, lastLoginAt: true },
      }),
      prisma.dailyRewardClaim.groupBy({ by: ["userId"], where: { userId: { in: batch } }, _count: { _all: true } }),
      prisma.completedQuest.groupBy({ by: ["userId"], where: { userId: { in: batch } }, _count: { _all: true } }),
      prisma.leagueMember.findMany({ where: { userId: { in: batch } }, select: { userId: true, points: true, updatedAt: true } }),
    ]);
    for (const u of users) usr.set(u.id, { cs: u.currentStreak, bs: u.bestStreak, ll: u.lastLoginAt?.getTime() ?? null });
    for (const d of daily) dailyCt.set(d.userId, d._count._all);
    for (const m of missions) missionCt.set(m.userId, m._count._all);
    // keep highest-points league row per user (their best/active season)
    for (const m of members) league.set(m.userId, Math.max(league.get(m.userId) ?? 0, m.points));
  }

  const players: P[] = grouped.map((g) => {
    const u = usr.get(g.userId);
    return {
      userId: g.userId,
      entries: g._count._all,
      lastEntry: g._max.paidAt!.getTime(),
      currentStreak: u?.cs ?? 0,
      bestStreak: u?.bs ?? 0,
      lastLoginAt: u?.ll ?? null,
      dailyClaims: dailyCt.get(g.userId) ?? 0,
      missionsDone: missionCt.get(g.userId) ?? 0,
      leaguePoints: league.get(g.userId) ?? 0,
      inLeague: league.has(g.userId),
    };
  });

  const engaged = players.filter((p) => p.entries >= 2);
  const once = players.filter((p) => p.entries === 1);

  const profile = (label: string, a: P[]) => {
    const activeLast7 = a.filter((p) => (now - p.lastEntry) / DAY <= 7).length;
    const activeLogin7 = a.filter((p) => p.lastLoginAt != null && (now - p.lastLoginAt) / DAY <= 7).length;
    console.log(`\n══ ${label} (n=${a.length}) ══`);
    console.log(`  still active — entered  ≤7d ago: ${pct(activeLast7, a.length)}   |  opened app ≤7d ago: ${pct(activeLogin7, a.length)}`);
    console.log(`  median days since last entry: ${(med(a.map((p) => (now - p.lastEntry) / DAY))).toFixed(1)}`);
    console.log(`  STREAK   — best≥3: ${pct(a.filter((p) => p.bestStreak >= 3).length, a.length)}   current≥2: ${pct(a.filter((p) => p.currentStreak >= 2).length, a.length)}   median best: ${med(a.map((p) => p.bestStreak))}`);
    console.log(`  DAILY    — claimed ≥1: ${pct(a.filter((p) => p.dailyClaims >= 1).length, a.length)}   claimed ≥3: ${pct(a.filter((p) => p.dailyClaims >= 3).length, a.length)}   median claims: ${med(a.map((p) => p.dailyClaims))}`);
    console.log(`  MISSIONS — completed ≥1: ${pct(a.filter((p) => p.missionsDone >= 1).length, a.length)}   median done: ${med(a.map((p) => p.missionsDone))}`);
    console.log(`  LEAGUE   — in a league: ${pct(a.filter((p) => p.inLeague).length, a.length)}   median points: ${med(a.map((p) => p.leaguePoints))}   mean: ${mean(a.map((p) => p.leaguePoints)).toFixed(0)}`);
  };

  console.log(`MiniPay tournament players: ${players.length}  |  engaged(≥2 entries): ${engaged.length}  |  one-and-done: ${once.length}`);
  profile("ENGAGED (≥2 entries)", engaged);
  profile("ONE-AND-DONE", once);
}

const timeout = setTimeout(() => {
  console.error(`[engaged-cohort-retention] Timed out after ${TIMEOUT_MS}ms`);
  process.exit(1);
}, TIMEOUT_MS);
main()
  .catch((e) => {
    console.error("[engaged-cohort-retention]", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
