import posthog from "posthog-js";
import process from "process";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  ui_host: "https://eu.posthog.com",
  defaults: '2026-01-30',
  debug: process.env.NODE_ENV === "development",
});