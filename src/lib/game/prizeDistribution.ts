/**
 * Prize Distribution Algorithm
 *
 * Distributes the claimable prize pool with bracketed rank schedules based on
 * the number of paid entrants.
 *
 * Brackets:
 * - 1-4 paid entrants: top 1 gets 100%
 * - 5-7 paid entrants: top 3 get 50% / 30% / 20%
 * - 8-14 paid entrants: top 5 get 31% / 23% / 18% / 15% / 13%
 * - 15-24 paid entrants: top 8 get 28% / 19% / 14% / 10% / 8% /
 *   7% / 7% / 7%
 * - 25-39 paid entrants: top 12 get 22% / 15% / 11% / 9% / 8% /
 *   7% / 6% / 5% / 5% / 4% / 4% / 4%
 * - 40-100 paid entrants: top 15 get
 *   22% / 14% / 10% / 8% / 7% / 6% / 5% / 5% / 4% / 4% /
 *   3.5% / 3% / 3% / 2.75% / 2.75%
 * - 101+ paid entrants: top 15 get
 *   40% / 14% / 9% / 6% / 5% / 4% / 4% / 3% / 3% / 2.5% /
 *   2% / 2% / 2% / 2% / 1.5%
 *
 * Tail winners are dropped if their prize would be smaller than their ticket
 * amount, then the remaining winner shares are normalized back to 100%.
 *
 * @module prizeDistribution
 */

// ============================================================================
// Configuration
// ============================================================================

/** Maximum number of players who receive prizes in the largest bracket */
export const WINNERS_COUNT = 15;

const BRACKET_SCHEDULES = {
  solo: [1],
  small: [0.5, 0.3, 0.2],
  generousSmall: [0.31, 0.23, 0.18, 0.15, 0.13],
  generousMedium: [0.28, 0.19, 0.14, 0.1, 0.08, 0.07, 0.07, 0.07],
  generousUpperMedium: [0.22, 0.15, 0.11, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.04],
  large: [0.22, 0.14, 0.1, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.035, 0.03, 0.03, 0.0275, 0.0275],
  expanded: [
    0.4,
    0.14,
    0.09,
    0.06,
    0.05,
    0.04,
    0.04,
    0.03,
    0.03,
    0.025,
    0.02,
    0.02,
    0.02,
    0.02,
    0.015,
  ],
} as const;

// ============================================================================
// Types
// ============================================================================

export interface PlayerEntry {
  id: string;
  userId: string;
  score: number;
  paidAmount: number;
  username?: string;
}

export interface PrizeAllocation {
  entryId: string;
  userId: string;
  rank: number;
  prize: number;
  username?: string;
  tier: "podium" | "runner" | "none";
}

export interface DistributionResult {
  allocations: PrizeAllocation[];
  prizePool: number;
  podiumTotal: number;
  runnersTotal: number;
}

// ============================================================================
// Core Algorithm
// ============================================================================

export function calculatePrizeDistribution(
  entries: PlayerEntry[],
  prizePool: number
): DistributionResult {
  const paidEntries = entries.filter((entry) => entry.paidAmount > 0);

  if (paidEntries.length === 0) {
    return {
      allocations: entries.map((entry, index) => ({
        entryId: entry.id,
        userId: entry.userId,
        rank: index + 1,
        prize: 0,
        username: entry.username,
        tier: "none",
      })),
      prizePool,
      podiumTotal: 0,
      runnersTotal: 0,
    };
  }

  const prizeAllocationByEntryId = new Map(
    buildWinnerAllocations(paidEntries, prizePool).map((allocation) => [
      allocation.entryId,
      allocation,
    ]),
  );

  const allocations = entries.map((entry, index) => {
    const prizeAllocation = prizeAllocationByEntryId.get(entry.id);
    return {
      entryId: entry.id,
      userId: entry.userId,
      rank: index + 1,
      prize: prizeAllocation?.prize ?? 0,
      username: entry.username,
      tier: prizeAllocation?.tier ?? "none",
    } satisfies PrizeAllocation;
  });

  const podiumTotal = allocations
    .filter((allocation) => allocation.tier === "podium")
    .reduce((sum, allocation) => sum + allocation.prize, 0);
  const runnersTotal = allocations
    .filter((allocation) => allocation.tier === "runner")
    .reduce((sum, allocation) => sum + allocation.prize, 0);

  return {
    allocations,
    prizePool,
    podiumTotal,
    runnersTotal,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScheduleForPaidEntrants(paidEntrants: number): number[] {
  if (paidEntrants <= 4) return [...BRACKET_SCHEDULES.solo];
  if (paidEntrants < 8) return [...BRACKET_SCHEDULES.small];
  if (paidEntrants < 15) return [...BRACKET_SCHEDULES.generousSmall];
  if (paidEntrants < 25) return [...BRACKET_SCHEDULES.generousMedium];
  if (paidEntrants < 40) return [...BRACKET_SCHEDULES.generousUpperMedium];
  if (paidEntrants > 100) return [...BRACKET_SCHEDULES.expanded];
  return [...BRACKET_SCHEDULES.large];
}

function buildWinnerAllocations(
  paidEntries: PlayerEntry[],
  prizePool: number
): PrizeAllocation[] {
  if (prizePool <= 0) {
    return [];
  }

  let schedule = getScheduleForPaidEntrants(paidEntries.length).slice(
    0,
    paidEntries.length
  );
  let normalizedSchedule = normalizeShares(schedule);

  while (
    normalizedSchedule.length > 0 &&
    normalizedSchedule.some((share, index) => prizePool * share < paidEntries[index].paidAmount)
  ) {
    schedule = schedule.slice(0, -1);
    normalizedSchedule = normalizeShares(schedule);
  }

  return paidEntries.slice(0, normalizedSchedule.length).map((entry, index) => ({
    entryId: entry.id,
    userId: entry.userId,
    rank: index + 1,
    prize: prizePool * normalizedSchedule[index],
    username: entry.username,
    tier: index < 3 ? "podium" : "runner",
  }));
}

function normalizeShares(shares: number[]): number[] {
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return shares.map(() => 0);
  return shares.map((share) => share / total);
}

/** The fraction of the pool the #1 finisher receives, given the paid-entrant
 *  count — i.e. `normalizedSchedule[0]` from the live bracket. Lets the lobby
 *  project the "win up to" headline before a round settles, using the exact
 *  same bracket math the settlement uses. Empty field → the eventual winner
 *  would take 100%. */
export function topWinnerShare(paidEntrants: number): number {
  if (paidEntrants <= 0) return 1;
  const schedule = getScheduleForPaidEntrants(paidEntrants).slice(0, paidEntrants);
  return normalizeShares(schedule)[0] ?? 1;
}

// ============================================================================
// Validation & Debug Utilities
// ============================================================================

export function validateDistribution(result: DistributionResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const totalPrizes = result.allocations.reduce((sum, allocation) => sum + allocation.prize, 0);
  const tolerance = 0.01;

  if (Math.abs(totalPrizes - result.prizePool) > tolerance) {
    errors.push(
      `Prize sum (${totalPrizes.toFixed(
        6
      )}) doesn't match prize pool (${result.prizePool.toFixed(6)})`
    );
  }

  const ranks = result.allocations.map((allocation) => allocation.rank);
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  if (JSON.stringify(ranks) !== JSON.stringify(sortedRanks)) {
    errors.push("Ranks are not in ascending order");
  }

  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== ranks.length) {
    errors.push("Duplicate ranks found");
  }

  return { valid: errors.length === 0, errors };
}

export function formatDistribution(result: DistributionResult): string {
  const lines = [
    `=== Prize Distribution ===`,
    `Prize Pool: $${result.prizePool.toFixed(2)}`,
    `Podium Total: $${result.podiumTotal.toFixed(2)}`,
    `Runners Total: $${result.runnersTotal.toFixed(2)}`,
    ``,
    `Rank | Tier    | Prize     | User`,
    `-`.repeat(50),
  ];

  for (const allocation of result.allocations) {
    if (allocation.prize > 0) {
      const tierLabel = allocation.tier.padEnd(7);
      const prizeStr = `$${allocation.prize.toFixed(2)}`.padStart(10);
      lines.push(
        `#${allocation.rank.toString().padEnd(3)} | ${tierLabel} | ${prizeStr} | ${
          allocation.username ?? allocation.userId
        }`
      );
    }
  }

  return lines.join("\n");
}
