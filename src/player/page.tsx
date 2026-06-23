"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ProtoProvider, useProto, type ScreenName } from "./state";
import { THEMES, ThemeProvider, resolveThemeId, type ThemeId } from "./theme";
import { CoachmarkProvider, TOURS, useCoachTour } from "./coachmarks";
import { BadgeUnlockWatcher } from "./badge-unlock";
import { AnnouncementToast } from "./announcements";
import dynamic from "next/dynamic";
import { DailyRewardSheet, hasUnclaimedDailyReward } from "./screens/daily-reward";
import { WorldCupTakeover } from "./screens/world-cup-takeover";
import { MigrationTakeover } from "./screens/migration-takeover";
import { LeagueResultTakeover, hasSeenLeagueResult } from "./screens/league-result";
import { getMigrationNotice, dismissMigrationNotice, getWorldCupTakeover, dismissWorldCupTakeover, loadLeagueResult, logClient } from "@/player/api";
import type { LeagueResult } from "@/lib/player/leagues";
import { OnboardingScreen } from "./screens/onboarding";
import { HomeScreen } from "./screens/home";
import { GameLoader, Phone } from "./shared";
import { preloadSounds, playSound } from "./sound";
import { useUser } from "@/hooks/useUser";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

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
  () => import("./screens/shop"),
  () => import("./screens/levels"),
  () => import("./screens/level-intro"),
  () => import("./screens/lobby"),
  () => import("./screens/question"),
  () => import("./screens/results"),
  () => import("./screens/level-result"),
  () => import("./screens/compete"),
  () => import("./screens/profile"),
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

  // Auth is mandatory — the app runs only on real server data, never a mock
  // fallback. `user` (from the cookie session) is the gate; first-timers go
  // through onboarding (which signs in), returning users with a lapsed cookie
  // are auto-signed-in here, and screens never render until state has hydrated.
  const { user, isLoading: userLoading } = useUser();
  const { signIn } = useWalletSignIn();
  const autoTried = useRef(false);
  const [autoFailed, setAutoFailed] = useState(false);
  useEffect(() => {
    if (user || userLoading || autoTried.current) return;
    if (!readOnboarded()) return; // first-timer → onboarding handles sign-in
    autoTried.current = true;
    void signIn().then((ok) => {
      if (!ok) setAutoFailed(true);
    });
  }, [user, userLoading, signIn]);

  const persistedOnboarded = useSyncExternalStore(subscribeNoop, readOnboarded, () => true);
  const [dismissed, setDismissed] = useState(false);
  // Onboarding shows for first-timers, or a returning user whose silent re-auth
  // failed — and stays mounted (even after sign-in succeeds) until its own
  // onPlay dismisses it, so the post-signup welcome card can play.
  const showOnboarding = (!persistedOnboarded || autoFailed) && !dismissed;
  // After onboarding, hold a loader until the session + first state load resolve
  // so no screen ever paints on the pre-load seed.
  const authPending = !showOnboarding && (userLoading || !user || !proto.hydrated);

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
  // Warm the SFX cache once so the first play of each sound is instant (no fetch
  // latency between a trigger and the sound).
  useEffect(() => {
    preloadSounds();
  }, []);

  // One global click sound for every button/interactive element — fires on
  // pointerdown (capture) so it's robust regardless of how each button wires its
  // handler. Replaces the scattered per-button playSound("click") calls.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(
        'button, [role="button"], .pressable, .cta, .btn-3d-gold',
      );
      if (!el) return;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return;
      playSound("click");
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, []);

  // One-time "welcome to v2" modal for migrated users — server-gated (migrated +
  // not yet dismissed). Takes precedence over the WC takeover + daily reward, and
  // gates them until the check resolves so they don't flash first.
  const [showMigration, setShowMigration] = useState(false);
  const [migrationResolved, setMigrationResolved] = useState(false);
  const migrationChecked = useRef(false);

  // precedence over the daily reward so the two never stack.
  const [showWcTakeover, setShowWcTakeover] = useState(false);
  // "Seen" is now DB-backed (worldCupTakeover.ts), so it's cross-device — resolve
  // it server-side once, on Home, like the migration notice.
  const [wcCanShow, setWcCanShow] = useState(false);
  const wcChecked = useRef(false);
  useEffect(() => {
    if (showOnboarding || proto.screen !== "home" || wcChecked.current) return;
    wcChecked.current = true;
    getWorldCupTakeover()
      .then((r) => setWcCanShow(r.show))
      .catch(() => {});
  }, [showOnboarding, proto.screen]);
  useEffect(() => {
    // Gated to Home so it never lands on the onboarding→first-level funnel. For a
    // first-timer this means it waits until they finish that level and return to
    // Home (their first Home visit); a returning user opens to Home and sees it
    // right away. No "first run" flag needed — the Home gate does the waiting.
    // Suppressed while a tournament-join intent is pending (the onboarding
    // finale funnel) so the WC takeover never covers the buy sheet — it can open
    // once that intent clears (the dep below re-runs this effect).
    if (!showOnboarding && proto.screen === "home" && migrationResolved && !showMigration && wcCanShow && !proto.pendingTournamentJoin) {
      // rAF so the flip isn't a synchronous setState in the effect body.
      const id = requestAnimationFrame(() => {
        trackClientEvent(AnalyticsEvent.WorldCupTakeoverAutoOpened, {
          screen: "home",
          theme_id: resolveThemeId(),
          entry_reason: "first_visit",
        });
        setShowWcTakeover(true);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [showOnboarding, proto.screen, migrationResolved, showMigration, wcCanShow, proto.pendingTournamentJoin]);

  useEffect(() => {
    if (showOnboarding || proto.screen !== "home" || migrationChecked.current) return;
    migrationChecked.current = true;
    getMigrationNotice()
      .then((r) => setShowMigration(r.show))
      .catch(() => {})
      .finally(() => setMigrationResolved(true));
  }, [showOnboarding, proto.screen]);
  const dismissMigration = () => {
    setShowMigration(false);
    void dismissMigrationNotice();
  };

  // Last settled league season's result (promotion/demotion + rewards), shown
  // once per season. Gated to Home and checked once; the component records the
  // season as seen on dismiss so it won't reappear.
  const [leagueResult, setLeagueResult] = useState<LeagueResult | null>(null);
  const leagueResultChecked = useRef(false);
  useEffect(() => {
    if (showOnboarding || proto.screen !== "home" || leagueResultChecked.current) return;
    leagueResultChecked.current = true;
    loadLeagueResult()
      .then((r) => {
        if (r && !hasSeenLeagueResult(r.season)) setLeagueResult(r);
      })
      .catch(() => {});
  }, [showOnboarding, proto.screen]);

  const dailyAutoShown = useRef(false);
  const { screen, update } = proto;
  useEffect(() => {
    // Suppressed while the onboarding join intent is pending so it can't stack
    // on top of the buy sheet; re-runs and can open once the intent clears.
    if (!showOnboarding && !showWcTakeover && screen === "home" && !proto.pendingTournamentJoin && !dailyAutoShown.current && hasUnclaimedDailyReward()) {
      dailyAutoShown.current = true;
      trackClientEvent(AnalyticsEvent.DailyRewardAutoOpened, {
        screen: "home",
        entry_reason: "unclaimed_reward",
      });
      update({ dailyOpen: true });
    }
  }, [showOnboarding, showWcTakeover, screen, update, proto.pendingTournamentJoin]);

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
    enabled: !showOnboarding && !showWcTakeover && !proto.wcTakeoverOpen && !proto.dailyOpen && !leagueResult,
  });

  return (
    <div className="waffles-v2-frame">
      {showOnboarding ? (
        <OnboardingScreen onPlay={dismissOnboarding} />
      ) : authPending ? (
        <ScreenFallback />
      ) : (
        <>
          <Current />
          {showMigration ? (
            <MigrationTakeover onClose={dismissMigration} />
          ) : showWcTakeover || proto.wcTakeoverOpen ? (
            <WorldCupTakeover
              onClose={() => {
                setShowWcTakeover(false);
                setWcCanShow(false);
                proto.update({ wcTakeoverOpen: false });
                // Persist "seen" DB-side (cross-device); idempotent on reopen.
                void dismissWorldCupTakeover();
              }}
            />
          ) : leagueResult ? (
            <LeagueResultTakeover result={leagueResult} onClose={() => setLeagueResult(null)} />
          ) : (
            proto.dailyOpen && <DailyRewardSheet onClose={() => proto.update({ dailyOpen: false })} />
          )}
        </>
      )}
      {/* Global: celebrates any newly-earned badge wherever the player is. */}
      <BadgeUnlockWatcher />
      {/* Global: a pushed announcement (PartyKit) slides in on any screen. */}
      <AnnouncementToast />
      {/* Global transient toast (e.g. a level whose server questions couldn't load). */}
      {proto.toast && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 90,
            transform: "translateX(-50%)",
            zIndex: 120,
            maxWidth: "86%",
            background: "rgba(20,16,12,.96)",
            border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            textAlign: "center",
            boxShadow: "0 8px 24px rgba(0,0,0,.4)",
            animation: "waffles-v2-onb-in .25s var(--ease-out-quart)",
          }}
        >
          {proto.toast}
        </div>
      )}
    </div>
  );
};

export default function Page() {
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
      const big = "color:#FFD24D;font-family:Archivo Black,sans-serif;font-size:22px;text-shadow:0 2px 0 #1e1e1e;padding:6px 0;";
      const small = "color:#888;font-size:11px;font-family:ui-monospace,monospace;";
      console.log("%c🧇 Waffles", big);
      console.log("%cReal-time multiplayer trivia. Built with care on Celo.", small);
      console.log("%cLike what you see? Drop us a line — playwaffles.xyz", small);
    }
  }, []);

  // Forward uncaught client errors + promise rejections to the server terminal,
  // so browser-side crashes (e.g. a screen render error) show up alongside the
  // server logs the operator is watching.
  useEffect(() => {
    const trunc = (s: string) => s.slice(0, 2000);
    const onError = (e: ErrorEvent) =>
      void logClient("[client-error]", trunc(`${e.message}  @ ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ""}`));
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      void logClient("[client-unhandled-rejection]", trunc(r instanceof Error ? `${r.message}\n${r.stack ?? ""}` : String(r)));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
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
