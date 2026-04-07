import posthog from "posthog-js";
import process from "process";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_TOKEN!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  ui_host: "https://eu.posthog.com",
  defaults: '2026-01-30',
  autocapture: true,
  debug: process.env.NODE_ENV === "development",
});

console.info("[posthog]", "client_initialized", {
  apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  hasToken: Boolean(process.env.NEXT_PUBLIC_POSTHOG_TOKEN),
  autocapture: true,
  debug: process.env.NODE_ENV === "development",
});
