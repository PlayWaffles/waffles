/**
 * Prize Distribution Algorithm
 *
 * Distributes the net prize pool with bracketed rank schedules based on the
 * number of paid entrants. A 20% platform fee is deducted before distribution.
 *
 * Brackets:
 * - 1 paid entrant: top 1 gets 100%
 * - 2-9 paid entrants: top 3 get 50% / 30% / 20%
 * - 10-39 paid entrants: top 5 get 50% / 20% / 15% / 7.5% / 7.5%
 * - 40+ paid entrants: top 10 get
 *   50% / 15% / 10% / 5% / 5% / 3% / 3% / 2% / 2% / 2%
 *
 * @module prizeDistribution
 */

// ============================================================================
// Configuration
// ============================================================================

/** Maximum number of players who receive prizes in the largest bracket */
export const WINNERS_COUNT = 10;

/** Platform fee in basis points (20% = 2000 bps) */
export const PLATFORM_FEE_BPS = 2000;

const BRACKET_SCHEDULES = {
  solo: [1],
  small: [0.5, 0.3, 0.2],
  medium: [0.5, 0.2, 0.15, 0.075, 0.075],
  large: [0.5, 0.15, 0.1, 0.05, 0.05, 0.04, 0.04, 0.025, 0.025, 0.02],
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
  grossPool: number;
  platformFee: number;
  netPool: number;
  podiumTotal: number;
  runnersTotal: number;
}

// ============================================================================
// Core Algorithm
// ============================================================================

export function calculatePrizeDistribution(
  entries: PlayerEntry[],
  grossPrizePool: number
): DistributionResult {
  const paidEntries = entries.filter((entry) => entry.paidAmount > 0);
  const platformFee = grossPrizePool * (PLATFORM_FEE_BPS / 10000);
  const netPool = grossPrizePool - platformFee;

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
      grossPool: grossPrizePool,
      platformFee,
      netPool,
      podiumTotal: 0,
      runnersTotal: 0,
    };
  }

  const prizeAllocationByEntryId = new Map(
    buildWinnerAllocations(paidEntries, netPool).map((allocation) => [
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
    grossPool: grossPrizePool,
    platformFee,
    netPool,
    podiumTotal,
    runnersTotal,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getScheduleForPaidEntrants(paidEntrants: number): number[] {
  if (paidEntrants <= 1) return [...BRACKET_SCHEDULES.solo];
  if (paidEntrants < 10) return [...BRACKET_SCHEDULES.small];
  if (paidEntrants < 40) return [...BRACKET_SCHEDULES.medium];
  return [...BRACKET_SCHEDULES.large];
}

function buildWinnerAllocations(
  paidEntries: PlayerEntry[],
  netPool: number
): PrizeAllocation[] {
  if (netPool <= 0) {
    return [];
  }

  const schedule = getScheduleForPaidEntrants(paidEntries.length).slice(
    0,
    paidEntries.length
  );
  const normalizedSchedule = normalizeShares(schedule);

  return paidEntries.slice(0, normalizedSchedule.length).map((entry, index) => ({
    entryId: entry.id,
    userId: entry.userId,
    rank: index + 1,
    prize: netPool * normalizedSchedule[index],
    username: entry.username,
    tier: index < 3 ? "podium" : "runner",
  }));
}

function normalizeShares(shares: number[]): number[] {
  const total = shares.reduce((sum, share) => sum + share, 0);
  if (total <= 0) return shares.map(() => 0);
  return shares.map((share) => share / total);
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

  if (Math.abs(totalPrizes - result.netPool) > tolerance) {
    errors.push(
      `Prize sum (${totalPrizes.toFixed(
        6
      )}) doesn't match net pool (${result.netPool.toFixed(6)})`
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
    `Gross Pool: $${result.grossPool.toFixed(2)}`,
    `Platform Fee: $${result.platformFee.toFixed(2)} (${
      PLATFORM_FEE_BPS / 100
    }%)`,
    `Net Pool: $${result.netPool.toFixed(2)}`,
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
