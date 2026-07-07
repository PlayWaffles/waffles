/**
 * Game lifecycle — backward-compatible re-exports over the settlement pipeline.
 *
 * Prefer importing from ./settlement for new code; these aliases keep existing
 * call sites (cron, admin, API) stable while the pipeline deepens underneath.
 */

export {
  rankStage as rankGame,
  publishStage as publishResults,
  notifyStage as sendResultNotifications,
  settleGame,
  type RankResult,
  type PublishResult,
  type SettleResult,
} from "./settlement";