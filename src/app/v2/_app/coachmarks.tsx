"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ScreenName } from "./state";

// Contextual coach marks — the "show me this part the first time I see it"
// onboarding games use. Each screen has a short tour (1–3 steps); a tour fires
// once on first visit, spotlights one real UI element, shows a tip, and is then
// marked seen in localStorage so it never nags again. Progressive disclosure:
// players learn each surface at the moment they land on it, not all up front.
//
// Tours are configured centrally in TOURS (keyed by screen) and driven from
// Stage via useCoachTour(proto.screen) — no per-screen wiring beyond a
// `data-coach="<id>"` attribute on the element each step points at.

export type CoachStep = {
  // data-coach id of the element to spotlight. Omit for a centred tip with no
  // spotlight (used when there's no single element worth isolating).
  target?: string;
  title: string;
  body: string;
  // Where the tip sits relative to its target. "auto" picks based on room.
  placement?: "auto" | "top" | "bottom";
};

export const TOURS: Partial<Record<ScreenName, CoachStep[]>> = {
  home: [
    {
      target: "home-join",
      title: "Join a live tournament",
      body: "Every hour, thousands answer the same questions at once. Tap here to jump in.",
      placement: "top",
    },
    {
      target: "home-continue",
      title: "Or warm up solo",
      body: "Not ready for a crowd? Play the level path at your own pace, any time.",
      placement: "top",
    },
    {
      target: "tabbar",
      title: "Everything's down here",
      body: "Switch between Levels, Compete, the Shop and your profile whenever you like.",
      placement: "top",
    },
  ],
  levels: [
    {
      target: "levels-play",
      title: "Start your level",
      body: "Answer the questions to clear this level and unlock the next tile on the path.",
      placement: "top",
    },
  ],
  levelIntro: [
    {
      target: "intro-lives",
      title: "Three lives per level",
      body: "A wrong answer costs a heart. Lose all three and you'll retry — so answer fast for bonus points.",
      placement: "top",
    },
  ],
  pass: [
    {
      target: "compete-ladder",
      title: "Climb the leagues",
      body: "Win tournaments to earn trophies and rise through the tiers. Finish each season high to move up.",
      placement: "bottom",
    },
  ],
  shop: [
    {
      title: "Power up your game",
      body: "Spend tickets on power-ups and cosmetics — or top up your ticket balance right here.",
    },
  ],
  profile: [
    {
      target: "profile-tickets",
      title: "These are your tickets",
      body: "Tickets get you into tournaments. Earn them from levels and top finishes, or grab more in the Shop.",
      placement: "bottom",
    },
  ],
  leaderboard: [
    {
      target: "leaderboard-you",
      title: "That's you",
      body: "Score points in tournaments and missions to climb your league's leaderboard before the season ends.",
      placement: "top",
    },
  ],
  leagues: [
    {
      target: "leagues-current",
      title: "This is your league",
      body: "Finish in the top spots before it ends to get promoted to the next league — and win bigger reward chests.",
      placement: "bottom",
    },
  ],
  missions: [
    {
      target: "missions-daily",
      title: "Daily missions",
      body: "Complete these for big XP — they reset every 24 hours. The Partners tab has offers that pay out bonus tickets.",
      placement: "bottom",
    },
  ],
};

// ----- Persistence -----------------------------------------------------------

const seenKey = (id: string) => `waffles.v2.coach.${id}`;

const wasSeen = (id: string) => {
  try {
    return localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return true; // storage unavailable — treat as seen so we never get stuck
  }
};

const markSeen = (id: string) => {
  try {
    localStorage.setItem(seenKey(id), "1");
  } catch {
    /* private mode / storage disabled — fine, it just shows again next session */
  }
};

// ----- Context ---------------------------------------------------------------

type ActiveTour = { id: string; steps: CoachStep[]; index: number };

type CoachAPI = {
  startTour: (id: string, steps: CoachStep[]) => void;
  // Clear a tour WITHOUT marking it seen — used when its screen unmounts mid-tour
  // so it gets another chance next visit.
  cancelTour: (id: string) => void;
  // Forget every "seen" flag so all tours replay. Handy for a "Replay tutorial".
  resetAll: () => void;
};

const CoachContext = createContext<CoachAPI | null>(null);

export function CoachmarkProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<ActiveTour | null>(null);

  const startTour = useCallback((id: string, steps: CoachStep[]) => {
    if (!steps.length || wasSeen(id)) return;
    setTour((prev) => (prev && prev.id === id ? prev : { id, steps, index: 0 }));
  }, []);

  const cancelTour = useCallback((id: string) => {
    setTour((prev) => (prev && prev.id === id ? null : prev));
  }, []);

  const resetAll = useCallback(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("waffles.v2.coach."))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    setTour(null);
  }, []);

  const advance = useCallback(() => {
    setTour((t) => {
      if (!t) return null;
      if (t.index + 1 >= t.steps.length) {
        markSeen(t.id);
        return null;
      }
      return { ...t, index: t.index + 1 };
    });
  }, []);

  const finish = useCallback(() => {
    setTour((t) => {
      if (t) markSeen(t.id);
      return null;
    });
  }, []);

  return (
    <CoachContext.Provider value={{ startTour, cancelTour, resetAll }}>
      {children}
      {tour && <CoachOverlay tour={tour} onNext={advance} onSkip={finish} />}
    </CoachContext.Provider>
  );
}

function useCoach(): CoachAPI {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error("useCoach must be used inside <CoachmarkProvider>");
  return ctx;
}

/**
 * Fire a tour once, the first time `id`'s screen is shown. Re-keys on `id` so it
 * re-fires when you navigate to a different screen. A short delay lets the
 * screen's entrance animation settle (and any programmatic scroll land) before
 * we measure the target.
 */
export function useCoachTour(
  id: string,
  steps: CoachStep[],
  opts: { enabled?: boolean; delayMs?: number } = {},
) {
  const { startTour, cancelTour } = useCoach();
  const { enabled = true, delayMs = 600 } = opts;

  // `steps` is a stable reference from the module-level TOURS config (an empty
  // `?? []` fallback is harmless — the effect early-returns on it), so it's safe
  // as a dependency and the effect only really re-runs when the screen changes.
  useEffect(() => {
    if (!enabled || !steps.length) return;
    const t = setTimeout(() => startTour(id, steps), delayMs);
    return () => {
      clearTimeout(t);
      cancelTour(id);
    };
  }, [id, enabled, delayMs, steps, startTour, cancelTour]);
}

// ----- Overlay ---------------------------------------------------------------

const TARGET_PAD = 8;
const TIP_GAP = 14;
const TIP_MAX_W = 300;

function CoachOverlay({
  tour,
  onNext,
  onSkip,
}: {
  tour: ActiveTour;
  onNext: () => void;
  onSkip: () => void;
}) {
  const step = tour.steps[tour.index];
  const isLast = tour.index === tour.steps.length - 1;

  const readRect = useCallback((target?: string): DOMRect | null => {
    if (!target || typeof document === "undefined") return null;
    const el = document.querySelector(`[data-coach="${target}"]`);
    return el ? el.getBoundingClientRect() : null;
  }, []);

  // Seed synchronously from the DOM so the spotlight is positioned on first
  // paint (no flash). The overlay only mounts client-side, so the DOM is here.
  const [rect, setRect] = useState<DOMRect | null>(() => readRect(step.target));

  // Re-measure on step change, and track scroll/resize so the spotlight follows
  // the element if the screen scrolls (scroll doesn't bubble, hence capture).
  useLayoutEffect(() => {
    const measure = () => setRect(readRect(step.target));
    // rAF (rather than a synchronous call) catches late layout from fonts,
    // images, and entrance transforms once they settle.
    const r1 = requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(r1);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step.target, readRect]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const vh = typeof window !== "undefined" ? window.innerHeight : 844;
  const tipW = Math.min(vw - 32, TIP_MAX_W);

  // Measure the tip's own height so we can place it on whichever side actually
  // has room and clamp it fully on-screen. Set inside rAF (not the effect body)
  // to avoid a synchronous setState-in-effect.
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipH, setTipH] = useState(0);
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      const h = tipRef.current?.offsetHeight ?? 0;
      setTipH((prev) => (prev === h ? prev : h));
    });
    return () => cancelAnimationFrame(id);
  }, [step.title, step.body, rect, tipW]);

  // Keyboard: Enter/Space advance, Escape skips.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onSkip]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Tip + caret geometry.
  let tipStyle: React.CSSProperties;
  let caret: ReactNode = null;

  if (rect) {
    const EDGE = 16;
    const estH = tipH || 170; // fall back to an estimate before first measure
    const centerX = rect.left + rect.width / 2;
    const tipLeft = Math.max(EDGE, Math.min(centerX - tipW / 2, vw - EDGE - tipW));
    // Space each side needs to host the tip without spilling off-screen.
    const needed = estH + TARGET_PAD + TIP_GAP + EDGE;
    const fitsBelow = vh - rect.bottom >= needed;
    const fitsAbove = rect.top >= needed;

    const caretLeft = Math.max(18, Math.min(centerX - tipLeft, tipW - 18));
    const caretBase: React.CSSProperties = {
      position: "absolute",
      left: caretLeft - 7,
      width: 14,
      height: 14,
      background: "var(--surface-2)",
      borderRight: "1px solid rgba(255,255,255,.1)",
      borderBottom: "1px solid rgba(255,255,255,.1)",
      transform: "rotate(45deg)",
    };

    if (!fitsBelow && !fitsAbove) {
      // Target is too tall to attach a tip beside it (e.g. a full-screen card).
      // Pin the tip fully on-screen near the bottom and drop the caret — the
      // spotlight ring already shows what's being described.
      tipStyle = { position: "fixed", left: tipLeft, top: Math.max(EDGE, vh - EDGE - estH), width: tipW };
    } else {
      // Prefer the requested side, but only when it actually fits; otherwise use
      // whichever side has room.
      const below = fitsBelow && !fitsAbove ? true
        : fitsAbove && !fitsBelow ? false
        : step.placement === "bottom" ? true
        : step.placement === "top" ? false
        : vh - rect.bottom >= rect.top;
      if (below) {
        tipStyle = { position: "fixed", left: tipLeft, top: rect.bottom + TARGET_PAD + TIP_GAP, width: tipW };
        caret = <div aria-hidden style={{ ...caretBase, top: -7, transform: "rotate(225deg)" }} />;
      } else {
        tipStyle = { position: "fixed", left: tipLeft, bottom: vh - (rect.top - TARGET_PAD) + TIP_GAP, width: tipW };
        caret = <div aria-hidden style={{ ...caretBase, bottom: -7 }} />;
      }
    }
  } else {
    tipStyle = { position: "fixed", left: "50%", top: "50%", width: tipW, transform: "translate(-50%, -50%)" };
  }

  return (
    <div
      className="waffles-v2"
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      onClick={onNext}
      style={{ position: "fixed", inset: 0, zIndex: 1000, cursor: "pointer" }}
    >
      {/* Dim layer. With a target, the dimming comes from the spotlight ring's
          huge box-shadow so the target stays bright; without one, a flat scrim. */}
      {!rect && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.72)" }} />}

      {rect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: rect.left - TARGET_PAD,
            top: rect.top - TARGET_PAD,
            width: rect.width + TARGET_PAD * 2,
            height: rect.height + TARGET_PAD * 2,
            borderRadius: 16,
            boxShadow: "0 0 0 9999px rgba(0,0,0,.72), 0 0 0 2px var(--maple-500), 0 0 26px rgba(255,201,49,.45)",
            pointerEvents: "none",
            animation: "waffles-v2-coach-ring 1.8s ease-in-out infinite",
          }}
        />
      )}

      {/* Tip card */}
      <div
        ref={tipRef}
        onClick={stop}
        style={{
          ...tipStyle,
          background: "var(--surface-2)",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 16,
          padding: "16px 16px 14px",
          boxShadow: "0 12px 40px rgba(0,0,0,.55)",
          cursor: "default",
          animation: "waffles-v2-coach-in .3s var(--ease-out-quart)",
        }}
      >
        {caret}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "var(--maple-500)", fontFamily: "var(--font-display)" }}>
            Tip {tour.index + 1} of {tour.steps.length}
          </span>
          <button
            type="button"
            className="pressable"
            onClick={onSkip}
            style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-faint)", padding: 4 }}
          >
            Skip
          </button>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", lineHeight: 1.15, marginBottom: 6 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45, fontWeight: 600, color: "var(--ink-mute)", marginBottom: 14 }}>
          {step.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* progress dots */}
          <div style={{ display: "flex", gap: 5, flex: 1 }}>
            {tour.steps.map((s, i) => (
              <span
                key={s.title}
                style={{
                  width: i === tour.index ? 18 : 6,
                  height: 6,
                  borderRadius: 99,
                  background: i === tour.index ? "var(--maple-500)" : "rgba(255,255,255,.18)",
                  transition: "width .3s var(--ease-out-quart)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onNext}
            style={{
              background: "var(--maple-500)",
              color: "var(--frame)",
              border: "none",
              borderRadius: 10,
              padding: "9px 18px",
              fontFamily: "var(--font-display)",
              fontSize: 14,
              letterSpacing: 0.3,
              boxShadow: "0 3px 0 rgba(0,0,0,.35)",
              cursor: "pointer",
            }}
          >
            {isLast ? "GOT IT" : "NEXT"}
          </button>
        </div>
      </div>
    </div>
  );
}
