export const AnalyticsEvent = {
  PageViewed: "$pageview",
  AppOpened: "app_opened",
  AuthStarted: "auth_started",
  AuthCompleted: "auth_completed",
  AuthFailed: "auth_failed",
  OnboardingStarted: "onboarding_started",
  OnboardingCompleted: "onboarding_completed",
  OnboardingFailed: "onboarding_failed",
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

  return attribution;
}

export function trackClientEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined") return;

  const umami = (
    window as Window & {
      umami?: {
        track: (
          event: string,
          data?: Record<string, string | number | boolean | null>,
        ) => void;
      };
    }
  ).umami;

  if (!umami) {
    console.error("[umami]", "tracker_unavailable", { event });
    return;
  }

  const data = Object.fromEntries(
    Object.entries({
      ...getStoredAttribution(),
      ...properties,
    }).filter((entry): entry is [string, string | number | boolean | null] => {
      const value = entry[1];
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      );
    }),
  );

  umami.track(event, data);
}
