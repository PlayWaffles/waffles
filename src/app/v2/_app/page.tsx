"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ProtoProvider, useProto, type ScreenName } from "./state";
import { THEMES, ThemeProvider, resolveThemeId, type ThemeId } from "./theme";
import { CoachmarkProvider, TOURS, useCoachTour } from "./coachmarks";
import { BadgeUnlockWatcher } from "./badge-unlock";
import dynamic from "next/dynamic";
import { DailyRewardSheet, hasUnclaimedDailyReward } from "./screens/daily-reward";
import { WorldCupTakeover, hasSeenWorldCupTakeover } from "./screens/world-cup-takeover";
import { OnboardingScreen } from "./screens/onboarding";
import { HomeScreen } from "./screens/home";
import { GameLoader, Phone } from "./shared";

// First-load budget: only the screens needed for the first paint ship in the
// initial bundle — Home (the SSR-prerendered landing) and Onboarding (the
// first-launch intro). Every other screen is code-split into its own chunk,
// loaded on navigation and then warmed on idle (see Stage's preload effect) so
// the initial JS stays small without making transitions feel laggy.
const ScreenFallback = () => (
  <Phone>
    <div className="bg-deep" />
    <GameLoader />
  </Phone>
);
const lazyScreen = (loader: () => Promise<{ default: React.ComponentType }>) =>
  dynamic(loader, { loading: ScreenFallback });

const SCREEN_COMPONENTS: Record<ScreenName, React.ComponentType> = {
  home: HomeScreen,
  levels: lazyScreen(() => import("./screens/levels").then((m) => ({ default: m.LevelPath }))),
  levelIntro: lazyScreen(() => import("./screens/level-intro").then((m) => ({ default: m.LevelIntroScreen }))),
  levelWin: lazyScreen(() => import("./screens/level-result").then((m) => ({ default: m.LevelWinScreen }))),
  levelFail: lazyScreen(() => import("./screens/level-result").then((m) => ({ default: m.LevelFailScreen }))),
  pass: lazyScreen(() => import("./screens/compete").then((m) => ({ default: m.CompeteScreen }))),
  shop: lazyScreen(() => import("./screens/shop").then((m) => ({ default: m.ShopScreen }))),
  leaderboard: lazyScreen(() => import("./screens/leaderboard").then((m) => ({ default: m.LeaderboardScreen }))),
  leagues: lazyScreen(() => import("./screens/leagues").then((m) => ({ default: m.LeaguesScreen }))),
  missions: lazyScreen(() => import("./screens/missions").then((m) => ({ default: m.MissionsScreen }))),
  lobby: lazyScreen(() => import("./screens/lobby").then((m) => ({ default: m.LobbyScreen }))),
  question: lazyScreen(() => import("./screens/question").then((m) => ({ default: m.QuestionScreen }))),
  results: lazyScreen(() => import("./screens/results").then((m) => ({ default: m.ResultsScreen }))),
  profile: lazyScreen(() => import("./screens/profile").then((m) => ({ default: m.ProfileScreen }))),
};

// Warmed during idle after first paint so navigating to a code-split screen is
// instant. Ordered by how soon a new player is likely to hit each one.
const SCREEN_PRELOADERS: Array<() => Promise<unknown>> = [
  () => import("./screens/levels"),
  () => import("./screens/level-intro"),
  () => import("./screens/lobby"),
  () => import("./screens/question"),
  () => import("./screens/results"),
  () => import("./screens/level-result"),
  () => import("./screens/compete"),
  () => import("./screens/profile"),
  () => import("./screens/shop"),
  () => import("./screens/leaderboard"),
  () => import("./screens/leagues"),
  () => import("./screens/missions"),
];

const ONBOARDED_KEY = "waffles.v2.onboarded";

// Read the persisted onboarding flag via useSyncExternalStore so the value is
// hydration-safe: the server snapshot assumes "already onboarded" (so SSR never
// renders the intro), and the client reconciles to the real localStorage value
// after hydration without a mismatch error. No external mutation to subscribe
// to — dismissal is tracked by local `dismissed` state below — so subscribe is
// a no-op.
const subscribeNoop = () => () => {};
const readOnboarded = () => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === "1";
  } catch {
    return true;
  }
};

const Stage = () => {
  const proto = useProto();
  const Current = SCREEN_COMPONENTS[proto.screen] ?? HomeScreen;

  const persistedOnboarded = useSyncExternalStore(subscribeNoop, readOnboarded, () => true);
  const [dismissed, setDismissed] = useState(false);
  const showOnboarding = !persistedOnboarded && !dismissed;

  // Daily reward auto-opens once per session, on the Home screen, after
  // onboarding — gated to Home so it never stacks on top of the lobby/quiz when
  // the onboarding finale funnels straight into a tournament. Driven via global
  // state (proto.dailyOpen) so any screen (e.g. the Home streak chip) can also
  // open it manually. Checked client-side post-mount to stay hydration-safe.
  // Ref guard (not state) so flipping "already shown" doesn't itself trigger a
  // setState-in-effect / re-run; the effect only mutates global state.
  // World Cup season welcome — the big "moment", shown once after onboarding.
  // The World Cup is the default season for everyone (not opt-in), so this is a
  // celebratory intro, not a gate; the bell entry reopens it anytime. Takes
  // precedence over the daily reward so the two never stack.
  const [showWcTakeover, setShowWcTakeover] = useState(false);
  useEffect(() => {
    // Gated to Home so it never lands on the onboarding→first-level funnel. For a
    // first-timer this means it waits until they finish that level and return to
    // Home (their first Home visit); a returning user opens to Home and sees it
    // right away. No "first run" flag needed — the Home gate does the waiting.
    if (!showOnboarding && proto.screen === "home" && !hasSeenWorldCupTakeover()) {
      // rAF so the flip isn't a synchronous setState in the effect body.
      const id = requestAnimationFrame(() => setShowWcTakeover(true));
      return () => cancelAnimationFrame(id);
    }
  }, [showOnboarding, proto.screen]);

  const dailyAutoShown = useRef(false);
  const { screen, update } = proto;
  useEffect(() => {
    if (!showOnboarding && !showWcTakeover && screen === "home" && !dailyAutoShown.current && hasUnclaimedDailyReward()) {
      dailyAutoShown.current = true;
      update({ dailyOpen: true });
    }
  }, [showOnboarding, showWcTakeover, screen, update]);

  // Warm the code-split screen chunks during idle time after first paint, so
  // they're cached before the player navigates — off the initial critical path.
  useEffect(() => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const run = () => SCREEN_PRELOADERS.forEach((p) => p());
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(run, 1500);
    return () => window.clearTimeout(id);
  }, []);

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      /* private mode / storage disabled — just hide for this session */
    }
    setDismissed(true);
  };

  // Contextual coach marks for the current screen — fire once per screen, but
  // never while the first-launch intro is up (its DOM has none of the targets).
  // Suppress the small coach tips while a full-screen overlay is up (onboarding,
  // WC takeover, daily reward) so they don't spotlight elements hidden behind it.
  // They run after the overlay is dismissed — progressive disclosure: big moment
  // first, then the contextual tips.
  useCoachTour(proto.screen, TOURS[proto.screen] ?? [], {
    enabled: !showOnboarding && !showWcTakeover && !proto.wcTakeoverOpen && !proto.dailyOpen,
  });

  return (
    <div className="waffles-v2-frame">
      {showOnboarding ? (
        <OnboardingScreen onPlay={dismissOnboarding} onSkip={dismissOnboarding} />
      ) : (
        <>
          <Current />
          {showWcTakeover || proto.wcTakeoverOpen ? (
            <WorldCupTakeover
              onClose={() => {
                setShowWcTakeover(false);
                proto.update({ wcTakeoverOpen: false });
              }}
            />
          ) : (
            proto.dailyOpen && <DailyRewardSheet onClose={() => proto.update({ dailyOpen: false })} />
          )}
        </>
      )}
      {/* Global: celebrates any newly-earned badge wherever the player is. */}
      <BadgeUnlockWatcher />
    </div>
  );
};

export default function V2Page() {
  // Active theme — resolved on the client (?theme=, localStorage, or an event
  // window). `data-theme` drives the CSS-variable skin; context carries copy.
  // Read via useSyncExternalStore so the server snapshot is "default" (no
  // hydration mismatch) and the client reconciles to the resolved theme — no
  // setState-in-effect needed. Same pattern as the onboarding flag above.
  const themeId = useSyncExternalStore(subscribeNoop, resolveThemeId, () => "world-cup" as ThemeId);

  useEffect(() => {
    // Easter egg for developers poking around in DevTools.
    if (typeof window !== "undefined" && !(window as unknown as { __wafflesGreeted?: boolean }).__wafflesGreeted) {
      (window as unknown as { __wafflesGreeted: boolean }).__wafflesGreeted = true;
      const big = "color:#FFC931;font-family:Archivo Black,sans-serif;font-size:22px;text-shadow:0 2px 0 #1e1e1e;padding:6px 0;";
      const small = "color:#888;font-size:11px;font-family:ui-monospace,monospace;";
      console.log("%c🧇 Waffles", big);
      console.log("%cReal-time multiplayer trivia. Built with care on Celo.", small);
      console.log("%cLike what you see? Drop us a line — playwaffles.xyz", small);
    }
  }, []);

  return (
    <div className="waffles-v2 waffles-v2-stage" data-theme={themeId}>
      <ThemeProvider value={THEMES[themeId]}>
        <ProtoProvider>
          <CoachmarkProvider>
            <Stage />
          </CoachmarkProvider>
        </ProtoProvider>
      </ThemeProvider>
    </div>
  );
}
