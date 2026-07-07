/**
 * Game Library
 */

export {
  calculatePrizeDistribution,
  formatDistribution,
  validateDistribution,
  WINNERS_COUNT,
  type PlayerEntry,
  type PrizeAllocation,
  type DistributionResult,
} from "./prizeDistribution";

export {
  scoreTournamentRound,
  scoreAnswer,
  scoreRound,
  type GameAnswerRecord,
  type ScorableQuestion,
  type RoundAnswer,
} from "./scoring-authority";

export { isTournamentGame, TOURNAMENT_WINDOW_MS } from "./scoring-mode";

export {
  rankStage,
  publishStage,
  notifyStage,
  settleGame,
  type RankResult,
  type PublishResult,
  type SettleResult,
} from "./settlement";

export {
  rankGame,
  publishResults,
  sendResultNotifications,
} from "./lifecycle";

export {
  getPhase,
  getGamePhase,
  canAnswer,
  canPurchaseTicket,
  canClaim,
  checkTiming,
  timingErrorStatus,
  type GamePhase,
  type GameTiming,
  type TimingGuardResult,
} from "./timing";

export {
  recordPaidEntry,
  type TicketSettlementInput,
  type TicketSettlementResult,
  type TicketSettlementUser,
} from "./ticket-settlement";