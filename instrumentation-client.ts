import posthog from "posthog-js";
import process from "process";

const posthogToken =
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN ||
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!posthogToken) {
  console.error("[posthog]", "client_init_failed", {
    reason: "NEXT_PUBLIC_POSTHOG_TOKEN or NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is required",
    apiHost: posthogHost,
  });
} else {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    autocapture: true,
    debug: process.env.NODE_ENV === "development",
  });

  console.info("[posthog]", "client_initialized", {
    apiHost: posthogHost,
    hasToken: true,
    autocapture: true,
    debug: process.env.NODE_ENV === "development",
  });
}
