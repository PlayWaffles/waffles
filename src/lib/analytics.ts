import { parsePlatform, PLATFORM_COOKIE } from "@/lib/platform/constants";

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
  OnboardingSlideViewed: "onboarding_slide_viewed",
  OnboardingSlideNextClicked: "onboarding_slide_next_clicked",
  OnboardingSlideDotClicked: "onboarding_slide_dot_clicked",
  OnboardingSkipped: "onboarding_skipped",
  OnboardingSignupClicked: "onboarding_signup_clicked",
  OnboardingUsernameEntered: "onboarding_username_entered",
  OnboardingCompleted: "onboarding_completed",
  UserOnboarded: "user_onboarded",
  OnboardingExploreClicked: "onboarding_explore_clicked",
  OnboardingLegalOpened: "onboarding_legal_opened",
  OnboardingFailed: "onboarding_failed",
  ShopViewed: "shop_viewed",
  ShopPurchaseIntent: "shop_purchase_intent",
  ShopPurchaseSucceeded: "shop_purchase_succeeded",
  ShopPurchaseFailed: "shop_purchase_failed",
  FirstTicketOfferViewed: "first_ticket_offer_viewed",
  FirstTicketOfferBuyClicked: "first_ticket_offer_buy_clicked",
  ResultsViewed: "results_viewed",
  ResultsWaitingViewed: "results_waiting_viewed",
  ResultsSettledViewed: "results_settled_viewed",
  RankRevealed: "rank_revealed",
  NearMissViewed: "near_miss_viewed",
  PrizeWalletCtaClicked: "prize_wallet_cta_clicked",
  ResultsDoneClicked: "results_done_clicked",
  ResultsPlayNextHourClicked: "results_play_next_hour_clicked",
  ProfileViewed: "profile_viewed",
  BadgeDetailOpened: "badge_detail_opened",
  PrizeClaimStarted: "prize_claim_started",
  PrizeConvertStarted: "prize_convert_started",
  ProfileDailyRewardClicked: "profile_daily_reward_clicked",
  ProfileLegalOpened: "profile_legal_opened",
  TutorialReplayClicked: "tutorial_replay_clicked",
  LeaderboardViewed: "leaderboard_viewed",
  LeaderboardTabChanged: "leaderboard_tab_changed",
  AboutLeaguesClicked: "about_leagues_clicked",
  InviteFriendsClicked: "invite_friends_clicked",
  LeaguesViewed: "leagues_viewed",
  LeagueCardViewed: "league_card_viewed",
  LeagueRewardsViewed: "league_rewards_viewed",
  LeaguesBackClicked: "leagues_back_clicked",
  DailyRewardViewed: "daily_reward_viewed",
  DailyRewardClaimStarted: "daily_reward_claim_started",
  DailyRewardClaimSucceeded: "daily_reward_claim_succeeded",
  DailyRewardClaimFailed: "daily_reward_claim_failed",
  DailyRewardAlreadyClaimed: "daily_reward_already_claimed",
  StreakFreezePurchaseStarted: "streak_freeze_purchase_started",
  StreakFreezePurchaseSucceeded: "streak_freeze_purchase_succeeded",
  StreakFreezePurchaseBlocked: "streak_freeze_purchase_blocked",
  CoachmarkTourStarted: "coachmark_tour_started",
  CoachmarkStepViewed: "coachmark_step_viewed",
  CoachmarkNextClicked: "coachmark_next_clicked",
  CoachmarkSkipped: "coachmark_skipped",
  CoachmarkCompleted: "coachmark_completed",
  CoachmarkReset: "coachmark_reset",
  ThemeResolved: "theme_resolved",
  ThemeOverrideApplied: "theme_override_applied",
  SoundToggled: "sound_toggled",
  BottomNavClicked: "bottom_nav_clicked",
  InfoOpened: "info_opened",
  InfoClosed: "info_closed",
  SheetOpened: "sheet_opened",
  SheetClosed: "sheet_closed",
  LegalSheetViewed: "legal_sheet_viewed",
  LegalTabChanged: "legal_tab_changed",
  LegalSheetClosed: "legal_sheet_closed",
  SupportTelegramClicked: "support_telegram_clicked",
  SupportEmailClicked: "support_email_clicked",
  SocialTwitterClicked: "social_twitter_clicked",
  BadgeUnlocked: "badge_unlocked",
  BadgeUnlockOverlayViewed: "badge_unlock_overlay_viewed",
  BadgeUnlockDismissed: "badge_unlock_dismissed",
  AnnouncementBannerViewed: "announcement_banner_viewed",
  AnnouncementBannerOpened: "announcement_banner_opened",
  AnnouncementBannerDismissed: "announcement_banner_dismissed",
  AnnouncementInboxOpened: "announcement_inbox_opened",
  AnnouncementInboxClosed: "announcement_inbox_closed",
  AnnouncementCtaClicked: "announcement_cta_clicked",
  AnnouncementMarkedRead: "announcement_marked_read",
  FormatLabViewed: "format_lab_viewed",
  FormatCardClicked: "format_card_clicked",
  FormatStageOpened: "format_stage_opened",
  FormatStageExited: "format_stage_exited",
  FormatQuestionPresented: "format_question_presented",
  FormatAnswerSubmitted: "format_answer_submitted",
  FormatAnswerResult: "format_answer_result",
  FormatQuestionTimeout: "format_question_timeout",
  FormatNextClicked: "format_next_clicked",
  FormatCompleted: "format_completed",
  FormatReplayed: "format_replayed",
  ExpansionFormatStarted: "expansion_format_started",
  ExpansionFormatInteraction: "expansion_format_interaction",
  ExpansionFormatSubmitted: "expansion_format_submitted",
  ExpansionFormatCompleted: "expansion_format_completed",
  ExpansionFormatExited: "expansion_format_exited",
  ShellLoaded: "v2_shell_loaded",
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
  FirstLevelStarted: "first_level_started",
  LevelQuestionStarted: "level_question_started",
  QuestionAnswerSubmitted: "question_answer_submitted",
  QuestionAnswerResult: "question_answer_result",
  QuestionTimeout: "question_timeout",
  QuestionNextClicked: "question_next_clicked",
  LevelCompleted: "level_completed",
  FirstLevelCompleted: "first_level_completed",
  LevelAdvanced: "level_advanced",
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
  MissionsViewed: "missions_viewed",
  MissionsTabChanged: "missions_tab_changed",
  MissionClaimClicked: "mission_claim_clicked",
  MissionClaimSucceeded: "mission_claim_succeeded",
  MissionClaimFailed: "mission_claim_failed",
  WalletChainSwitchStarted: "wallet_chain_switch_started",
  TicketCtaClicked: "ticket_cta_clicked",
  // Home / engagement clicks
  StreakButtonClicked: "streak_button_clicked",
  ViewStandingClicked: "view_standing_clicked",
  SeeRankingClicked: "see_ranking_clicked",
  NextLevelClicked: "next_level_clicked",
  ComingSoonClicked: "coming_soon_clicked",
  // Dwell + abandonment
  ScreenDwellRecorded: "screen_dwell_recorded",
  GameQuitPrompted: "game_quit_prompted",
  GameQuit: "game_quit",
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
  PostFirstLevelUpsellShown: "post_first_level_upsell_shown",
  PostFirstLevelUpsellAccepted: "post_first_level_upsell_accepted",
  PostFirstLevelUpsellDismissed: "post_first_level_upsell_dismissed",
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
  track: {
    (
      event: string,
      data?: Record<string, string | number | boolean | null>,
    ): void;
    (
      payload: (
        defaults: Record<string, string | number | boolean | null>,
      ) => Record<string, unknown>,
    ): void;
  };
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

function getCookieValue(name: string) {
  if (typeof document === "undefined") return null;

  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

function getCurrentPlatformTag() {
  return parsePlatform(getCookieValue(PLATFORM_COOKIE));
}

function getEventPlatformTag(data: Record<string, string | number | boolean | null>) {
  return parsePlatform(typeof data.platform === "string" ? data.platform : null);
}

function sendUmamiEvent(
  umami: UmamiTracker,
  event: string,
  data: Record<string, string | number | boolean | null>,
) {
  const tag = getEventPlatformTag(data);
  if (!tag) {
    umami.track(event, data);
    return;
  }

  umami.track((defaults) => ({
    ...defaults,
    name: event,
    tag,
    data,
  }));
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
    if (item) sendUmamiEvent(umami, item.event, item.data);
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
    platform: getCurrentPlatformTag(),
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

  sendUmamiEvent(umami, event, data);
  flushAnalyticsQueue();
}
