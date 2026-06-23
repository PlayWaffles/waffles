/**
 * Deeper read-only analysis of MiniPay tournament players:
 *   A. Recency cohort of the one-and-done — new (recent) vs churned (old).
 *   B. League-tier breakdown — entries / campaign play by tier.
 *   C. Causation proxy — does campaign play precede / predict tournament return?
 *
 * No writes. Run: node --env-file=.env --import tsx scripts/tournament-cohort-analysis.ts
 */
import { prisma } from "@/lib/db";
import { LevelTrack, UserPlatform } from "@prisma";

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
  firstEntry: number;
  lastEntry: number;
  createdAt: number;
  std: number;
  wc: number;
  campaignUpdated: number | null; // last level-up among tracks with level>1
  tier: string;
  points: number;
};

async function main() {
  const now = Date.now();

  const grouped = await prisma.gameEntry.groupBy({
    by: ["userId"],
    where: { paidAt: { not: null }, game: { platform: UserPlatform.MINIPAY, onchainId: { not: null } } },
    _count: { _all: true },
    _min: { paidAt: true },
    _max: { paidAt: true },
  });
  const ids = grouped.map((g) => g.userId);

  const createdById = new Map<string, number>();
  const levelByUser = new Map<string, { std: number; wc: number; campaignUpdated: number | null }>();
  const leagueByUser = new Map<string, { tier: string; points: number; updated: number }>();

  for (const batch of chunk(ids, CHUNK)) {
    const [users, levels, members] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: batch } }, select: { id: true, createdAt: true } }),
      prisma.levelProgress.findMany({
        where: { userId: { in: batch } },
        select: { userId: true, track: true, level: true, updatedAt: true },
      }),
      prisma.leagueMember.findMany({
        where: { userId: { in: batch } },
        select: { userId: true, points: true, updatedAt: true, league: { select: { label: true } } },
      }),
    ]);
    for (const u of users) createdById.set(u.id, u.createdAt.getTime());
    for (const lp of levels) {
      const cur = levelByUser.get(lp.userId) ?? { std: 1, wc: 1, campaignUpdated: null };
      if (lp.track === LevelTrack.STANDARD) cur.std = lp.level;
      else if (lp.track === LevelTrack.WORLD_CUP) cur.wc = lp.level;
      if (lp.level > 1) {
        const t = lp.updatedAt.getTime();
        cur.campaignUpdated = cur.campaignUpdated == null ? t : Math.max(cur.campaignUpdated, t);
      }
      levelByUser.set(lp.userId, cur);
    }
    for (const m of members) {
      const prev = leagueByUser.get(m.userId);
      const t = m.updatedAt.getTime();
      if (!prev || t > prev.updated) leagueByUser.set(m.userId, { tier: m.league.label, points: m.points, updated: t });
    }
  }

  const players: P[] = grouped.map((g) => {
    const lvl = levelByUser.get(g.userId) ?? { std: 1, wc: 1, campaignUpdated: null };
    const lg = leagueByUser.get(g.userId);
    return {
      userId: g.userId,
      entries: g._count._all,
      firstEntry: g._min.paidAt!.getTime(),
      lastEntry: g._max.paidAt!.getTime(),
      createdAt: createdById.get(g.userId) ?? g._min.paidAt!.getTime(),
      std: lvl.std,
      wc: lvl.wc,
      campaignUpdated: lvl.campaignUpdated,
      tier: lg?.tier ?? "(none)",
      points: lg?.points ?? 0,
    };
  });
  const n = players.length;
  const playsCampaign = (p: P) => p.std > 1 || p.wc > 1;

  // ── A. One-and-done recency ───────────────────────────────────────────────
  const once = players.filter((p) => p.entries === 1);
  const ageBuckets = { "≤2d": 0, "3-7d": 0, "8-30d": 0, ">30d": 0 };
  for (const p of once) {
    const d = (now - p.lastEntry) / DAY;
    if (d <= 2) ageBuckets["≤2d"]++;
    else if (d <= 7) ageBuckets["3-7d"]++;
    else if (d <= 30) ageBuckets["8-30d"]++;
    else ageBuckets[">30d"]++;
  }
  const impulse = once.filter((p) => p.firstEntry - p.createdAt <= 3600_000).length; // entered ≤1h after signup
  console.log(`\n══ A. ONE-AND-DONE (${once.length} of ${n}, ${pct(once.length, n)}) — recency ══`);
  for (const [k, v] of Object.entries(ageBuckets)) console.log(`  last (only) entry ${k} ago: ${v} (${pct(v, once.length)})`);
  console.log(`  entered ≤1h after signing up (impulse): ${impulse} (${pct(impulse, once.length)})`);
  console.log(`  median days signup→entry: ${(med(once.map((p) => (p.firstEntry - p.createdAt) / DAY))).toFixed(2)}`);

  // ── B. League tier ────────────────────────────────────────────────────────
  const tiers = new Map<string, P[]>();
  for (const p of players) (tiers.get(p.tier) ?? tiers.set(p.tier, []).get(p.tier)!).push(p);
  console.log(`\n══ B. LEAGUE TIER (of tournament players) ══`);
  console.log(`  ${"TIER".padEnd(14)} ${"players".padStart(8)} ${"mean entries".padStart(13)} ${"% repeat".padStart(9)} ${"% campaign".padStart(11)}`);
  for (const [tier, ps] of [...tiers.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const rep = ps.filter((p) => p.entries > 1).length;
    const cam = ps.filter(playsCampaign).length;
    console.log(`  ${tier.padEnd(14)} ${String(ps.length).padStart(8)} ${mean(ps.map((p) => p.entries)).toFixed(2).padStart(13)} ${pct(rep, ps.length).padStart(9)} ${pct(cam, ps.length).padStart(11)}`);
  }

  // ── C. Causation proxy: campaign vs return ────────────────────────────────
  const camP = players.filter(playsCampaign);
  const noCamP = players.filter((p) => !playsCampaign(p));
  const returnRate = (a: P[]) => pct(a.filter((p) => p.entries > 1).length, a.length);
  // Of campaign players, how many had their (last) level-up BEFORE their first
  // tournament entry — i.e. campaign engagement demonstrably preceded tournaments.
  const campaignFirst = camP.filter((p) => p.campaignUpdated != null && p.campaignUpdated < p.firstEntry).length;
  console.log(`\n══ C. CAMPAIGN → RETURN ══`);
  console.log(`  return rate (entered >1×):`);
  console.log(`     plays campaign  (n=${camP.length}): ${returnRate(camP)}`);
  console.log(`     no campaign     (n=${noCamP.length}): ${returnRate(noCamP)}`);
  console.log(`  campaign players whose last level-up predates their 1st entry (campaign-first): ${campaignFirst} (${pct(campaignFirst, camP.length)})`);
  console.log(`  median entries — campaign: ${med(camP.map((p) => p.entries))}  vs no-campaign: ${med(noCamP.map((p) => p.entries))}`);
}

const timeout = setTimeout(() => {
  console.error(`[tournament-cohort-analysis] Timed out after ${TIMEOUT_MS}ms`);
  process.exit(1);
}, TIMEOUT_MS);
main()
  .catch((e) => {
    console.error("[tournament-cohort-analysis]", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timeout);
    await prisma.$disconnect();
  });
