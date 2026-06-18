/**
 * League season-close settlement. For every cohort from a season that has ended
 * (and isn't yet settled): rank members by points, set each member's finishing
 * rank + promotion/demotion outcome, and grant the band rewards (syrup +
 * power-ups + boosts — never tickets/coins). Idempotent: a cohort's `settledAt`
 * guards re-settlement, and a member's existing `outcome` guards re-granting
 * after a partial/crashed run. Driven by the in-process cron (`src/lib/cron.ts`).
 */
import { prisma } from "@/lib/db";
import { LeagueOutcome, TicketLedgerReason } from "@prisma";
import { adjustTickets } from "./playerState";
import { grantBoost, grantPowerUp } from "./economy";
import { bandForRank, currentSeason, LEAGUE_TIERS, type LeagueRewardRow } from "./leagues";

// Per-cohort movement (a cohort holds up to ~30 players).
export const PROMOTE_TOP = 7;
export const DEMOTE_BOTTOM = 5;

type CohortRow = {
  id: string;
  league: { tier: import("@prisma").LeagueTier; rewards: unknown };
};

/** Grant a band's rewards to one player (best-effort per grant). */
async function grantReward(userId: string, reward: LeagueRewardRow, refId: string): Promise<void> {
  if (reward.syrup > 0) {
    await adjustTickets(userId, reward.syrup, TicketLedgerReason.LEAGUE_REWARD, {
      refId,
      note: `league:${reward.r}`,
    });
  }
  for (const p of reward.powerUps) await grantPowerUp(userId, p.kind, p.n);
  if (reward.boost) await grantBoost(userId, reward.boost.kind, reward.boost.charges, null);
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
  // Demotion zone never overlaps the promotion zone in small cohorts.
  const demoteFrom = Math.max(PROMOTE_TOP, members.length - DEMOTE_BOTTOM);

  let rewarded = 0;
  for (let i = 0; i < members.length; i++) {
    const rank = i + 1;
    const m = members[i];

    let outcome: LeagueOutcome = LeagueOutcome.STAYED;
    if (!isTop && rank <= PROMOTE_TOP) outcome = LeagueOutcome.PROMOTED;
    else if (!isBottom && rank > demoteFrom) outcome = LeagueOutcome.DEMOTED;

    await prisma.leagueMember.update({ where: { id: m.id }, data: { rank, outcome } });

    // Only grant on a member's first settlement pass (outcome was still null),
    // so re-running after a partial failure never double-pays.
    if (m.outcome === null) {
      const band = bandForRank(rank);
      const reward = band ? byBand.get(band) : undefined;
      if (reward) {
        await grantReward(m.userId, reward, cohort.id);
        rewarded++;
      }
    }
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
