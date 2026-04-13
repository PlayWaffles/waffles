/**
 * Game Library
 *
 * Exports all game-related utilities including:
 * - Server-side cached queries
 * - Prize distribution logic
 * - Scoring algorithms
 * - Game lifecycle management
 */

// Queries (server-side, cached)
export {
  getCurrentOrNextGame,
  getGameById,
  getLastGameWinners,
  type GameWithQuestionCount,
  type GameQueryResult,
  type LastGameResult,
  type LastGameWinner,
} from "./queries";

// Prize distribution
export {
  calculatePrizeDistribution,
  formatDistribution,
  validateDistribution,
  WINNERS_COUNT,
  PLATFORM_FEE_BPS,
  type PlayerEntry,
  type PrizeAllocation,
  type DistributionResult,
} from "./prizeDistribution";

// Scoring
export * from "./scoring";

// Lifecycle
export {
  rankGame,
  publishResults,
  type RankResult,
  type PublishResult,
} from "./lifecycle";
