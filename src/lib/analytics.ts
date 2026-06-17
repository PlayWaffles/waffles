export const AnalyticsEvent = {
  PageViewed: "$pageview",
  AppOpened: "app_opened",
  FirstTouchAttributionCaptured: "first_touch_attribution_captured",
  MiniappContextDetected: "miniapp_context_detected",
  AuthStarted: "auth_started",
  AuthCompleted: "auth_completed",
  AuthFailed: "auth_failed",
  AuthAutoSigninStarted: "auth_auto_signin_started",
  AuthAutoSigninCompleted: "auth_auto_signin_completed",
  AuthAutoSigninFailed: "auth_auto_signin_failed",
  AuthAutoSigninSkipped: "auth_auto_signin_skipped",
  WalletConnectStarted: "wallet_connect_started",
  WalletConnectCompleted: "wallet_connect_completed",
  WalletConnectFailed: "wallet_connect_failed",
  AuthNonceRequested: "auth_nonce_requested",
  AuthSignatureRequested: "auth_signature_requested",
  AuthSignatureCompleted: "auth_signature_completed",
  OnboardingStarted: "onboarding_started",
  OnboardingCompleted: "onboarding_completed",
  OnboardingFailed: "onboarding_failed",
  V2ShellLoaded: "v2_shell_loaded",
  ScreenViewed: "screen_viewed",
  ScreenBackClicked: "screen_back_clicked",
  LevelTrackChanged: "level_track_changed",
  UsernameSetStarted: "username_set_started",
  UsernameSetSucceeded: "username_set_succeeded",
  UsernameSetFailed: "username_set_failed",
  AnnouncementDismissStarted: "announcement_dismiss_started",
  AnnouncementDismissSucceeded: "announcement_dismiss_succeeded",
  AnnouncementMarkReadStarted: "announcement_mark_read_started",
  AnnouncementMarkReadSucceeded: "announcement_mark_read_succeeded",
  DailyRewardAutoOpened: "daily_reward_auto_opened",
  WorldCupTakeoverAutoOpened: "world_cup_takeover_auto_opened",
  LevelStarted: "level_started",
  LevelQuestionStarted: "level_question_started",
  QuestionAnswerSubmitted: "question_answer_submitted",
  QuestionAnswerResult: "question_answer_result",
  QuestionTimeout: "question_timeout",
  QuestionNextClicked: "question_next_clicked",
  LevelCompleted: "level_completed",
  LevelFailed: "level_failed",
  LevelRetryClicked: "level_retry_clicked",
  LifeLost: "life_lost",
  LivesRefillStarted: "lives_refill_started",
  LivesRefillSucceeded: "lives_refill_succeeded",
  LivesRefillBlocked: "lives_refill_blocked",
  TournamentEntryStarted: "tournament_entry_started",
  TournamentEntrySucceeded: "tournament_entry_succeeded",
  TournamentEntryBlocked: "tournament_entry_blocked",
  TournamentLobbyEntered: "tournament_lobby_entered",
  TournamentStarted: "tournament_started",
  TournamentQuestionStarted: "tournament_question_started",
  TournamentScoreSubmitted: "tournament_score_submitted",
  TournamentResultLocalSettled: "tournament_result_local_settled",
  PrizeResolutionStarted: "prize_resolution_started",
  PrizeResolutionSucceeded: "prize_resolution_succeeded",
  PrizeResolutionFailed: "prize_resolution_failed",
  PowerupUseStarted: "powerup_use_started",
  PowerupUseSucceeded: "powerup_use_succeeded",
  PowerupUseFailed: "powerup_use_failed",
  MissionProgressRecorded: "mission_progress_recorded",
  GameSeen: "game_seen",
  TicketCtaClicked: "ticket_cta_clicked",
  TicketPurchaseBlocked: "ticket_purchase_blocked",
  TicketPurchaseStarted: "ticket_purchase_started",
  TicketApprovalSubmitted: "ticket_approval_submitted",
  TicketApprovalConfirmed: "ticket_approval_confirmed",
  TicketPurchaseTxSubmitted: "ticket_purchase_tx_submitted",
  TicketPurchaseTxConfirmed: "ticket_purchase_tx_confirmed",
  TicketPurchaseSyncStarted: "ticket_purchase_sync_started",
  TicketPurchaseSyncSucceeded: "ticket_purchase_sync_succeeded",
  TicketPurchaseSyncFailed: "ticket_purchase_sync_failed",
  TicketPurchaseFailed: "ticket_purchase_failed",
  ReferralRedeemed: "referral_redeemed",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

const ATTRIBUTION_STORAGE_KEY = "waffles:attribution:first-touch";
const SESSION_STORAGE_KEY = "waffles:analytics:session-id";
const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
  "referrer",
  "source",
] as const;

const BLOCKED_PROPERTY_KEYS = new Set([
  "address",
  "wallet",
  "wallet_address",
  "signature",
  "tx_hash",
  "txHash",
  "transaction_hash",
  "email",
  "message",
  "support_message",
  "payment_identifier",
]);

type UmamiTracker = {
  track: (
    event: string,
    data?: Record<string, string | number | boolean | null>,
  ) => void;
};

type QueuedEvent = {
  event: string;
  data: Record<string, string | number | boolean | null>;
};

const pendingEvents: QueuedEvent[] = [];
let flushScheduled = false;
let flushAttempts = 0;

function getUmami(): UmamiTracker | undefined {
  if (typeof window === "undefined") return undefined;
  return (
    window as Window & {
      umami?: UmamiTracker;
    }
  ).umami;
}

function scheduleFlush() {
  if (typeof window === "undefined" || flushScheduled) return;
  flushScheduled = true;
  window.setTimeout(() => {
    flushScheduled = false;
    flushAnalyticsQueue();
  }, Math.min(1000 * 2 ** flushAttempts, 8000));
}

function flushAnalyticsQueue() {
  const umami = getUmami();
  if (!umami) {
    flushAttempts += 1;
    if (flushAttempts <= 6) scheduleFlush();
    return;
  }

  flushAttempts = 0;
  while (pendingEvents.length) {
    const item = pendingEvents.shift();
    if (item) umami.track(item.event, item.data);
  }
}

function shortHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function getSessionId() {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return undefined;
  }
}

export function hashAnalyticsId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  return shortHash(String(value));
}

export function hashAnalyticsValue(value: string | number | null | undefined) {
  return hashAnalyticsId(value);
}

export function getStoredAttribution() {
  if (typeof window === "undefined") return {};

  const stored = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
  if (!stored) return {};

  try {
    const parsed = JSON.parse(stored) as AnalyticsProperties;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function captureFirstTouchAttribution() {
  if (typeof window === "undefined") return {};

  const existing = getStoredAttribution();
  if (Object.keys(existing).length > 0) return existing;

  const params = new URLSearchParams(window.location.search);
  const attribution: AnalyticsProperties = {
    landing_path: window.location.pathname,
    landing_url: window.location.href,
    document_referrer: document.referrer || null,
  };

  for (const key of ATTRIBUTION_PARAMS) {
    const value = params.get(key);
    if (value) attribution[key] = value;
  }

  window.localStorage.setItem(
    ATTRIBUTION_STORAGE_KEY,
    JSON.stringify(attribution),
  );

  trackClientEvent(AnalyticsEvent.FirstTouchAttributionCaptured, attribution);
  return attribution;
}

export function getClientAnalyticsContext(properties: AnalyticsProperties = {}) {
  if (typeof window === "undefined") return properties;

  return {
    path: window.location.pathname,
    session_id: getSessionId(),
    ...properties,
  };
}

function sanitizeProperties(properties: AnalyticsProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, string | number | boolean | null] => {
      const [key, value] = entry;
      if (BLOCKED_PROPERTY_KEYS.has(key)) return false;
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      );
    }),
  );
}

export function trackClientEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined") return;

  const data = sanitizeProperties({
      ...getStoredAttribution(),
      ...getClientAnalyticsContext(),
      ...properties,
    });

  const umami = getUmami();
  if (!umami) {
    pendingEvents.push({ event, data });
    scheduleFlush();
    return;
  }

  umami.track(event, data);
  flushAnalyticsQueue();
}
