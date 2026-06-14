"use client";

import { createContext, useContext } from "react";

// ===== Theme / Season system =================================================
// A theme reskins the WHOLE app (not a separate route) along a few layers:
//   • Skin   — CSS variable overrides applied via [data-theme] (see styles.css)
//   • Copy   — strings the screens read from `theme.copy`
//   • Content — an optional question `pack` filter (wire into the bank later)
// Spinning up a new event (Euros, Olympics, Halloween) = add one entry here +
// a [data-theme] block in styles.css + an asset/question pack. No app fork.

export type ThemeId = "default" | "world-cup";

export type Theme = {
  id: ThemeId;
  name: string;
  // Optional question-pack tag; when set, themed games draw only from it.
  questionPack?: string;
  copy: {
    appName: string;     // header wordmark
    liveBadge: string;   // the pulsing "LIVE" chip
    liveTitle: string;   // the hourly event name
    liveTagline: string; // event subline
  };
};

export const THEMES: Record<ThemeId, Theme> = {
  default: {
    id: "default",
    name: "Waffles",
    copy: {
      appName: "WAFFLES",
      liveBadge: "LIVE NEXT HOUR",
      liveTitle: "Top of the Hour",
      liveTagline: "Mixed trivia · 6 questions · 90s",
    },
  },
  "world-cup": {
    id: "world-cup",
    name: "Waffles · World Cup",
    questionPack: "world-cup",
    copy: {
      appName: "WAFFLES ⚽ WORLD CUP",
      liveBadge: "KICKOFF NEXT HOUR",
      liveTitle: "Match of the Hour",
      liveTagline: "Football trivia · 6 questions · 90s",
    },
  },
};

// Resolve the active theme. The World Cup is the live season, so it's the
// default skin for EVERYONE — not an opt-in. An explicit override (?theme= or
// localStorage) can still force another skin (e.g. ?theme=default for QA).
// SSR returns the same default so there's no hydration mismatch.
export function resolveThemeId(): ThemeId {
  if (typeof window === "undefined") return "world-cup";
  const isValid = (v: string | null): v is ThemeId => v === "default" || v === "world-cup";
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (isValid(q)) return q;
    const stored = localStorage.getItem("waffles.v2.theme");
    if (isValid(stored)) return stored;
  } catch {
    /* storage/url unavailable — fall through to the season default */
  }
  return "world-cup";
}

// Persist a theme override (e.g. ?theme=default for QA, or a future opt-out).
// A reload after this lets resolveThemeId() pick it up and reskin the app.
export function setThemeOverride(id: ThemeId): void {
  try {
    localStorage.setItem("waffles.v2.theme", id);
  } catch {
    /* storage disabled — can't persist the choice */
  }
}

const ThemeContext = createContext<Theme>(THEMES.default);
export const ThemeProvider = ThemeContext.Provider;
export const useTheme = (): Theme => useContext(ThemeContext);
