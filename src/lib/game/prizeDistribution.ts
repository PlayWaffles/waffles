/**
 * Prize Distribution Algorithm
 *
 * Distributes prize pool among top 10 winners with tiered system:
 * - Top 3 (Podium): Share 70% of net pool proportionally by ticket
 * - Ranks 4-10 (Runners): Share 30% of net pool proportionally by ticket
 *
 * Within each tier: same ticket = same prize (purely ticket-proportional).
 * 20% platform fee is deducted before distribution.
 *
 * @module prizeDistribution
 */

// ============================================================================
// Configuration
// ============================================================================

/** Number of players who receive prizes */
export const WINNERS_COUNT = 10;

/** Platform fee in basis points (20% = 2000 bps) */
export const PLATFORM_FEE_BPS = 2000;

/** Podium ranks (top 3) share this percentage of net pool */
const PODIUM_SHARE = 0.7; // 70%

/** Runners (ranks 4-10) share this percentage of net pool */
const RUNNERS_SHARE = 0.3; // 30%

// ============================================================================
// Types
// ============================================================================

export interface PlayerEntry {
  id: string;
  userId: string;
  score: number;
  paidAmount: number; // Ticket price paid (tier)
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

/**
 * Calculate prize distribution for all players.
 *
 * Algorithm:
 * 1. Deduct platform fee (20%)
 * 2. Split net pool: 70% podium, 30% runners
 * 3. Podium (1-3): Distribute proportionally by ticket amount
 * 4. Runners (4-10): Distribute proportionally by ticket amount
 * 5. Others: Rank only, no prize
 *
 * Within each tier: same ticket = same prize. No rank-based weighting.
 *
 * Edge cases handled:
 * - Less than 3 players: Podium share redistributed among available
 * - Less than 10 players: Runner share among available
 * - Zero total tickets: Equal split within tier
 * - Single winner: Gets full net pool
 *
 * @param entries - All game entries sorted by score DESC, updatedAt ASC
 * @param grossPrizePool - Total prize pool before fees
 * @returns Distribution result with all allocations
 */
export function calculatePrizeDistribution(
  entries: PlayerEntry[],
  grossPrizePool: number
): DistributionResult {
  // Filter only paid entries
  const paidEntries = entries.filter((e) => e.paidAmount > 0);

  // Calculate fee and net pool
  const platformFee = grossPrizePool * (PLATFORM_FEE_BPS / 10000);
  const netPool = grossPrizePool - platformFee;

  // Handle no entries case
  if (paidEntries.length === 0) {
    return {
      allocations: entries.map((e, i) => ({
        entryId: e.id,
        userId: e.userId,
        rank: i + 1,
        prize: 0,
        username: e.username,
        tier: "none",
      })),
      grossPool: grossPrizePool,
      platformFee,
      netPool,
      podiumTotal: 0,
      runnersTotal: 0,
    };
  }

  const overallRankByEntryId = new Map(entries.map((entry, index) => [entry.id, index + 1]));

  // Single winner edge case
  if (paidEntries.length === 1) {
    const onlyPaidEntry = paidEntries[0];
    return {
      allocations: entries.map((e, i) => ({
        entryId: e.id,
        userId: e.userId,
        rank: i + 1,
        prize: e.id === onlyPaidEntry.id ? netPool : 0,
        username: e.username,
        tier: e.id === onlyPaidEntry.id ? "podium" : "none",
      })),
      grossPool: grossPrizePool,
      platformFee,
      netPool,
      podiumTotal: netPool,
      runnersTotal: 0,
    };
  }

  // Split entries into tiers
  const podiumEntries = paidEntries.slice(0, Math.min(3, paidEntries.length));
  const runnerEntries = paidEntries.slice(
    3,
    Math.min(WINNERS_COUNT, paidEntries.length)
  );
  const nonWinners = paidEntries.slice(WINNERS_COUNT);

  // Calculate tier pools based on actual participant counts
  const { podiumPool, runnersPool } = calculateTierPools(
    netPool,
    podiumEntries.length,
    runnerEntries.length
  );

  // Distribute podium prizes (proportional by ticket)
  const podiumAllocations = distributeByTicket(
    podiumEntries,
    podiumPool,
    overallRankByEntryId,
    "podium"
  );

  // Distribute runner prizes (proportional by ticket)
  const runnerAllocations = distributeByTicket(
    runnerEntries,
    runnersPool,
    overallRankByEntryId,
    "runner"
  );
  const prizeAllocationByEntryId = new Map(
    [...podiumAllocations, ...runnerAllocations].map((allocation) => [
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

  return {
    allocations,
    grossPool: grossPrizePool,
    platformFee,
    netPool,
    podiumTotal: podiumAllocations.reduce((sum, a) => sum + a.prize, 0),
    runnersTotal: runnerAllocations.reduce((sum, a) => sum + a.prize, 0),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate tier pools, redistributing if tiers are incomplete.
 */
function calculateTierPools(
  netPool: number,
  podiumCount: number,
  runnerCount: number
): { podiumPool: number; runnersPool: number } {
  // No runners → podium gets everything
  if (runnerCount === 0) {
    return { podiumPool: netPool, runnersPool: 0 };
  }

  // Standard split with both tiers
  const podiumPool = netPool * PODIUM_SHARE;
  const runnersPool = netPool * RUNNERS_SHARE;

  return { podiumPool, runnersPool };
}

/**
 * Distribute prizes proportionally by ticket amount within a tier.
 *
 * Formula: prize = (playerTicket / totalTickets) × tierPool
 *
 * Same ticket = same prize. No rank-based weighting.
 * If all tickets are equal, prizes are equal within the tier.
 */
function distributeByTicket(
  entries: PlayerEntry[],
  pool: number,
  overallRankByEntryId: Map<string, number>,
  tier: "podium" | "runner"
): PrizeAllocation[] {
  if (entries.length === 0 || pool <= 0) return [];

  const totalTickets = entries.reduce((sum, e) => sum + e.paidAmount, 0);

  return entries.map((entry, i) => ({
    entryId: entry.id,
    userId: entry.userId,
    rank: overallRankByEntryId.get(entry.id) ?? i + 1,
    prize:
      totalTickets > 0
        ? (entry.paidAmount / totalTickets) * pool
        : pool / entries.length,
    username: entry.username,
    tier,
  }));
}

// ============================================================================
// Validation & Edge Case Utilities
// ============================================================================

/**
 * Validate distribution result for consistency.
 * Useful for testing and debugging.
 */
export function validateDistribution(result: DistributionResult): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check that total prizes equal net pool (within floating point tolerance)
  const totalPrizes = result.allocations.reduce((sum, a) => sum + a.prize, 0);
  const tolerance = 0.01; // 1 cent tolerance

  if (Math.abs(totalPrizes - result.netPool) > tolerance) {
    errors.push(
      `Prize sum (${totalPrizes.toFixed(
        6
      )}) doesn't match net pool (${result.netPool.toFixed(6)})`
    );
  }

  // Check rank ordering
  const ranks = result.allocations.map((a) => a.rank);
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  if (JSON.stringify(ranks) !== JSON.stringify(sortedRanks)) {
    errors.push("Ranks are not in ascending order");
  }

  // Check for duplicate ranks
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== ranks.length) {
    errors.push("Duplicate ranks found");
  }

  // Check that tier totals respect 70/30 split (when both tiers have participants)
  const podiumTotal = result.podiumTotal;
  const runnersTotal = result.runnersTotal;

  if (podiumTotal > 0 && runnersTotal > 0) {
    const podiumRatio = podiumTotal / (podiumTotal + runnersTotal);
    // Should be ~70% (allow some tolerance for rounding)
    if (Math.abs(podiumRatio - 0.7) > 0.05) {
      errors.push(
        `Podium ratio (${(podiumRatio * 100).toFixed(
          1
        )}%) doesn't match expected 70%`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Format distribution for logging/debugging.
 */
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

  for (const a of result.allocations) {
    if (a.prize > 0) {
      const tierLabel = a.tier.padEnd(7);
      const prizeStr = `$${a.prize.toFixed(2)}`.padStart(10);
      lines.push(
        `#${a.rank.toString().padEnd(3)} | ${tierLabel} | ${prizeStr} | ${
          a.username ?? a.userId
        }`
      );
    }
  }

  return lines.join("\n");
}
