/**
 * League season-close settlement. For every cohort from a season that has ended
 * (and isn't yet settled): rank members by points, set each member's finishing
 * rank + promotion/demotion outcome, and grant the band rewards (syrup +
 * power-ups + boosts — never tickets/coins). Idempotent: a cohort's `settledAt`
 * guards re-settlement, and a member's existing `outcome` guards re-granting
 * after a partial/crashed run. Driven by the in-process cron (`src/lib/cron.ts`).
 */
import { prisma } from "@/lib/db";
import { LeagueOutcome, Prisma, TicketLedgerReason } from "@prisma";
import { adjustTickets } from "./playerState";
import { grantBoostTx, grantPowerUpTx } from "./economy";
import { bandForRank, currentSeason, LEAGUE_TIERS, type LeagueRewardRow } from "./leagues";

// Per-cohort movement. Full cohorts (~30) promote the top 7 / demote the bottom
// 5; smaller cohorts scale down proportionally so there's always a "stayed"
// middle (a 10-player cohort moves ~3 up / ~2 down, not 7/5).
export const PROMOTE_TOP = 7;
export const DEMOTE_BOTTOM = 5;
const PROMOTE_FRAC = 0.25; // ~top quarter, capped at PROMOTE_TOP
const DEMOTE_FRAC = 0.15; // ~bottom 15%, capped at DEMOTE_BOTTOM

type CohortRow = {
  id: string;
  league: { tier: import("@prisma").LeagueTier; rewards: unknown };
};

/** Grant a band's rewards to one player, inside the caller's transaction so the
 *  whole grant commits atomically with the member's outcome write. */
async function grantReward(
  tx: Prisma.TransactionClient,
  userId: string,
  reward: LeagueRewardRow,
  refId: string,
): Promise<void> {
  if (reward.syrup > 0) {
    await adjustTickets(userId, reward.syrup, TicketLedgerReason.LEAGUE_REWARD, {
      refId,
      note: `league:${reward.r}`,
      tx,
    });
  }
  for (const p of reward.powerUps) await grantPowerUpTx(tx, userId, p.kind, p.n);
  if (reward.boost) await grantBoostTx(tx, userId, reward.boost.kind, reward.boost.charges, null);
}

/** Rank, reward, and promote/demote a single cohort, then stamp it settled. */
async function settleCohort(cohort: CohortRow): Promise<number> {
  const members = await prisma.leagueMember.findMany({
    where: { cohortId: cohort.id },
    // Ties broken by who reached the score first (earlier updatedAt ranks higher).
    orderBy: [{ points: "desc" }, { updatedAt: "asc" }],
    select: { id: true, userId: true, outcome: true },
  });

  const tierIdx = LEAGUE_TIERS.findIndex((t) => t.tier === cohort.league.tier);
  const isTop = tierIdx === LEAGUE_TIERS.length - 1;
  const isBottom = tierIdx <= 0;
  const rewards = (Array.isArray(cohort.league.rewards) ? cohort.league.rewards : []) as LeagueRewardRow[];
  const byBand = new Map(rewards.map((r) => [r.r, r]));

  // Promote/demote counts scaled to cohort size (capped). The top tier never
  // promotes, the bottom tier never demotes. demoteFrom keeps the two zones from
  // overlapping, and demote=0 (or promote=0) collapses that zone to nothing.
  const n = members.length;
  const promote = isTop ? 0 : Math.min(PROMOTE_TOP, Math.max(1, Math.round(n * PROMOTE_FRAC)));
  const demote = isBottom ? 0 : Math.min(DEMOTE_BOTTOM, Math.round(n * DEMOTE_FRAC));
  const demoteFrom = Math.max(promote, n - demote);

  let rewarded = 0;
  for (let i = 0; i < members.length; i++) {
    const rank = i + 1;
    const m = members[i];

    let outcome: LeagueOutcome = LeagueOutcome.STAYED;
    if (rank <= promote) outcome = LeagueOutcome.PROMOTED;
    else if (rank > demoteFrom) outcome = LeagueOutcome.DEMOTED;

    // Reward only on a member's first settlement pass (outcome was still null in
    // the pre-run snapshot), so re-running never double-pays.
    let reward: LeagueRewardRow | undefined;
    if (m.outcome === null) {
      const band = bandForRank(rank);
      reward = band ? byBand.get(band) : undefined;
    }

    // Atomic: the rank/outcome write and the reward grant commit together. If the
    // grant crashes, the whole member rolls back (outcome stays null) and the next
    // run redoes it cleanly — never a skipped or half-paid reward.
    await prisma.$transaction(async (tx) => {
      await tx.leagueMember.update({ where: { id: m.id }, data: { rank, outcome } });
      if (reward) await grantReward(tx, m.userId, reward, cohort.id);
    });
    if (reward) rewarded++;
  }

  await prisma.leagueCohort.update({ where: { id: cohort.id }, data: { settledAt: new Date() } });
  return rewarded;
}

/** Settle every unsettled cohort from a season earlier than `season` (default:
 *  the current ISO-week season, so only finished weeks are closed). */
export async function closeLeagueSeason(
  opts: { season?: string } = {},
): Promise<{ cohorts: number; rewarded: number }> {
  const upTo = opts.season ?? currentSeason();
  const cohorts = await prisma.leagueCohort.findMany({
    where: { settledAt: null, season: { lt: upTo } },
    select: { id: true, league: { select: { tier: true, rewards: true } } },
  });

  let settled = 0;
  let rewarded = 0;
  for (const cohort of cohorts) {
    try {
      rewarded += await settleCohort(cohort);
      settled++;
    } catch (e) {
      console.error(`[leagues] settle cohort ${cohort.id} failed:`, e);
    }
  }
  return { cohorts: settled, rewarded };
}
