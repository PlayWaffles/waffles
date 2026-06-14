"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useProto } from "./state";
import { playSound, soundManager } from "./sound";

const ASSETS_BASE = "/images/v2";
const OPTIMIZED_ASSETS_BASE = `${ASSETS_BASE}/optimized`;

// Re-rendering clock. Returns `Date.now()` refreshed every `intervalMs` while
// `active`, so components can show live countdowns without calling the impure
// Date.now() during render. Lazy init keeps the first paint hydration-stable.
export function useNow(active = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export const ASSETS = {
  wally: `${OPTIMIZED_ASSETS_BASE}/wally.webp`,
  ticket: `${OPTIMIZED_ASSETS_BASE}/ticket.webp`,
  flame: `${OPTIMIZED_ASSETS_BASE}/flame.webp`,
  trophy: `${OPTIMIZED_ASSETS_BASE}/trophy.webp`,
  heartFull: `${OPTIMIZED_ASSETS_BASE}/heart-full.webp`,
  heartEmpty: `${OPTIMIZED_ASSETS_BASE}/heart-empty.webp`,
  heartBroken: `${OPTIMIZED_ASSETS_BASE}/heart-broken.webp`,
  lock: `${OPTIMIZED_ASSETS_BASE}/lock.webp`,
  vipStar: `${OPTIMIZED_ASSETS_BASE}/vip-star.webp`,
  xpGem: `${OPTIMIZED_ASSETS_BASE}/xp-gem.webp`,
  powerup5050: `${OPTIMIZED_ASSETS_BASE}/powerup-5050.webp`,
  powerupTime: `${OPTIMIZED_ASSETS_BASE}/powerup-time.webp`,
  powerupSkip: `${OPTIMIZED_ASSETS_BASE}/powerup-skip.webp`,
  powerupShield: `${OPTIMIZED_ASSETS_BASE}/powerup-shield.webp`,
  chestRainbow: `${OPTIMIZED_ASSETS_BASE}/chest-rainbow.webp`,
  chestPurple: `${OPTIMIZED_ASSETS_BASE}/chest-purple.webp`,
  chestBrown: `${OPTIMIZED_ASSETS_BASE}/chest-brown.webp`,
  medalApprentice: `${OPTIMIZED_ASSETS_BASE}/medal-apprentice.webp`,
  medalSilver: `${OPTIMIZED_ASSETS_BASE}/medal-silver.webp`,
  medalAdvanced: `${OPTIMIZED_ASSETS_BASE}/medal-advanced.webp`,
  medalGenius: `${OPTIMIZED_ASSETS_BASE}/medal-genius.webp`,
  medalMaster: `${OPTIMIZED_ASSETS_BASE}/medal-master.webp`,
  avatarFox: `${OPTIMIZED_ASSETS_BASE}/avatar-fox.webp`,
  avatarBear: `${OPTIMIZED_ASSETS_BASE}/avatar-bear.webp`,
  avatarFrog: `${OPTIMIZED_ASSETS_BASE}/avatar-frog.webp`,
  avatarPanda: `${OPTIMIZED_ASSETS_BASE}/avatar-panda.webp`,
  avatarOwl: `${OPTIMIZED_ASSETS_BASE}/avatar-owl.webp`,
  avatarCat: `${OPTIMIZED_ASSETS_BASE}/avatar-cat.webp`,
  avatarDog: `${OPTIMIZED_ASSETS_BASE}/avatar-dog.webp`,
  avatarRabbit: `${OPTIMIZED_ASSETS_BASE}/avatar-rabbit.webp`,
  bossNightOwl: `${OPTIMIZED_ASSETS_BASE}/boss-night-owl.webp`,
  iconTarget: `${OPTIMIZED_ASSETS_BASE}/icon-target.webp`,
  iconCalendar: `${OPTIMIZED_ASSETS_BASE}/icon-calendar.webp`,
  coin: `${OPTIMIZED_ASSETS_BASE}/golden-coin.webp`,
  logoWordmark: `${OPTIMIZED_ASSETS_BASE}/logo-wordmark.webp`,
  // Forest scene (twilight Levels world)
  forestFloorTile: `${OPTIMIZED_ASSETS_BASE}/forest-floor-tile.webp`,
  forestGridCellGrass: `${OPTIMIZED_ASSETS_BASE}/forest-grid-cell-grass.webp`,
  cloud: `${OPTIMIZED_ASSETS_BASE}/cloud.webp`,
  terrainStone: `${OPTIMIZED_ASSETS_BASE}/terrain-stone.webp`,
  forestCabin: `${OPTIMIZED_ASSETS_BASE}/forest-cabin.webp`,
  forestPond: `${OPTIMIZED_ASSETS_BASE}/forest-pond.webp`,
  forestFrog: `${OPTIMIZED_ASSETS_BASE}/forest-frog.webp`,
  forestTreePine: `${OPTIMIZED_ASSETS_BASE}/forest-tree-pine.webp`,
  forestTreeBush: `${OPTIMIZED_ASSETS_BASE}/forest-tree-bush.webp`,
  forestMushroom: `${OPTIMIZED_ASSETS_BASE}/forest-mushroom.webp`,
  forestFlowers: `${OPTIMIZED_ASSETS_BASE}/forest-flowers.webp`,
  forestStump: `${OPTIMIZED_ASSETS_BASE}/forest-stump.webp`,
  forestSignpost: `${OPTIMIZED_ASSETS_BASE}/forest-signpost.webp`,
  forestFirefly: `${OPTIMIZED_ASSETS_BASE}/forest-firefly.webp`,
  // World Cup scenery — football-stadium props for the WC level track (generated
  // to match the forest sprite style). Swapped in by track in levels.tsx.
  wcStadium: `${OPTIMIZED_ASSETS_BASE}/wc-stadium.webp`,
  wcFloodlight: `${OPTIMIZED_ASSETS_BASE}/wc-floodlight.webp`,
  wcCornerFlag: `${OPTIMIZED_ASSETS_BASE}/wc-corner-flag.webp`,
  wcFootball: `${OPTIMIZED_ASSETS_BASE}/wc-football.webp`,
  wcScoreboard: `${OPTIMIZED_ASSETS_BASE}/wc-scoreboard.webp`,
  wcCone: `${OPTIMIZED_ASSETS_BASE}/wc-cone.webp`,
  wcPodium: `${OPTIMIZED_ASSETS_BASE}/wc-podium.webp`,
  wcBalloons: `${OPTIMIZED_ASSETS_BASE}/wc-balloons.webp`,
  wcSignboard: `${OPTIMIZED_ASSETS_BASE}/wc-signboard.webp`,
  // Loading spinner — a gold arc ring; rotate continuously via CSS.
  spinner: `${OPTIMIZED_ASSETS_BASE}/spinner.webp`,
  forestMoon: `${OPTIMIZED_ASSETS_BASE}/forest-moon.webp`,
  forestSceneHero: `${OPTIMIZED_ASSETS_BASE}/forest-scene-hero.webp`,
  wallyStump: `${OPTIMIZED_ASSETS_BASE}/wally-stump.webp`,
  // Isometric waffle path slabs (3D-rendered tiles for the levels world)
  waffleSlabActive: `${OPTIMIZED_ASSETS_BASE}/waffle-slab-active.webp`,
  waffleSlabDone: `${OPTIMIZED_ASSETS_BASE}/waffle-slab-done.webp`,
  waffleSlabLocked: `${OPTIMIZED_ASSETS_BASE}/waffle-slab-locked.webp`,
} as const;

// Pixel-art image helper. `imageRendering: pixelated` keeps the chunky aesthetic when scaled.
export const PixelImg = ({
  src,
  size,
  alt = "",
  style,
  className,
  priority = "visible",
}: {
  src: string;
  size: number;
  alt?: string;
  style?: CSSProperties;
  className?: string;
  priority?: "visible" | "deferred";
}) => (
  <img
    src={src}
    alt={alt}
    className={className}
    decoding="async"
    fetchPriority={priority === "visible" ? "auto" : "low"}
    loading={priority === "visible" ? "eager" : "lazy"}
    style={{
      width: size,
      height: size,
      objectFit: "contain",
      imageRendering: "pixelated",
      display: "inline-block",
      flexShrink: 0,
      filter: "drop-shadow(0 3px 0 rgba(0, 0, 0, 0.28)) drop-shadow(0 8px 10px rgba(0, 0, 0, 0.24))",
      verticalAlign: "middle",
      ...style,
    }}
  />
);

export const AssetWell = ({
  children,
  size = 56,
  accent = "var(--maple-500)",
  radius = 12,
  style,
}: {
  children: ReactNode;
  size?: number;
  accent?: string;
  radius?: number;
  style?: CSSProperties;
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius,
      background:
        `radial-gradient(circle at 35% 25%, ${accent}38, transparent 58%), linear-gradient(180deg, rgba(253, 251, 246, 0.08), rgba(253, 251, 246, 0.015))`,
      border: `1.5px solid ${accent}55`,
      boxShadow: `inset 0 1px 0 rgba(253, 251, 246, 0.18), inset 0 -5px 12px rgba(0, 0, 0, 0.24), 0 4px 0 rgba(0, 0, 0, 0.28), 0 0 22px ${accent}22`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0,
      ...style,
    }}
  >
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 5,
        borderRadius: Math.max(4, radius - 5),
        border: "1px solid rgba(253, 251, 246, 0.07)",
        pointerEvents: "none",
      }}
    />
    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  </div>
);

export const Phone = ({ children }: { children: ReactNode; statusDark?: boolean; time?: string }) => (
  <div className="phone">
    <div className="body">{children}</div>
  </div>
);

// `color` arg kept for API compatibility but no longer used — pixel art has fixed palette.
export const TicketIcon = ({ size = 18 }: { size?: number; color?: string }) => {
  const height = Math.max(size, 26);
  const width = Math.round(height * 1.34);

  return (
    <PixelImg
      src={ASSETS.ticket}
      size={height}
      alt="ticket"
      style={{
        width,
        height,
      }}
    />
  );
};

export const FlameIcon = ({ size = 16 }: { size?: number }) => (
  <PixelImg
    src={ASSETS.flame}
    size={size}
    alt="streak"
    style={{
      animation: "waffles-v2-flame-flicker 1.4s ease-in-out infinite",
      transformOrigin: "bottom center",
    }}
  />
);

// Confetti — one-shot celebration burst rendered via 36 absolutely positioned
// pieces with randomised offsets, colours, and timings via inline CSS vars.
// CSS-only animation; no library dependency. Auto-disables under
// prefers-reduced-motion via the global stylesheet rule.
const CONFETTI_COLORS = ["#FFC931", "#00CFF2", "#FB72FF", "#FF6B6B", "#7BE57E"];
export const Confetti = ({ pieces = 36 }: { pieces?: number }) => (
  <div
    aria-hidden="true"
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: 50,
    }}
  >
    {Array.from({ length: pieces }).map((_, i) => {
      const startX = (i / pieces) * 100; // spread across width 0–100%
      const drift = (Math.sin(i * 1.7) * 60).toFixed(0); // sideways drift in px
      const rot = 540 + Math.round(Math.sin(i * 0.9) * 360); // total rotation
      const dur = 1.6 + ((i * 13) % 10) * 0.12; // 1.6s – 2.8s
      const delay = ((i * 17) % 11) * 0.05; // 0 – 0.5s stagger
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      const w = 6 + (i % 4) * 2;
      return (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${startX}%`,
            top: 0,
            width: w,
            height: w * 1.6,
            background: color,
            borderRadius: 1,
            opacity: 0,
            ["--cf-dx" as string]: `${drift}px`,
            ["--cf-rot" as string]: `${rot}deg`,
            animation: `waffles-v2-confetti-fall ${dur}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s forwards`,
          }}
        />
      );
    })}
  </div>
);

// Spinning loading indicator — the gold arc-ring asset rotated continuously.
// Reusable at any size; CSS-only, auto-stills under prefers-reduced-motion via
// the global rule.
export const Spinner = ({ size = 56, label }: { size?: number; label?: string }) => (
  <PixelImg
    src={ASSETS.spinner}
    size={size}
    alt={label ?? ""}
    priority="visible"
    style={{ display: "block", animation: "waffles-v2-spin 0.85s linear infinite" }}
  />
);

// Game loader — branded indeterminate loading state (the rotating gold spinner
// with a soft glow + label). Used as the code-split screen fallback so the jump
// between screens shows something alive instead of a blank panel. CSS-only;
// auto-stills under prefers-reduced-motion via the global rule.
export const GameLoader = ({ label = "Loading" }: { label?: string }) => (
  <div aria-busy="true" aria-live="polite" aria-label={label} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
    {/* Soft maple glow behind the spinner */}
    <div aria-hidden style={{ position: "absolute", width: 240, height: 240, background: "radial-gradient(circle, rgba(255,201,49,.16), transparent 65%)" }} />

    <Spinner size={72} />

    <div style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,.45)", textTransform: "uppercase" }}>{label}</div>
  </div>
);

// Shared top-of-screen back button — the chunky brand button (cream fill + the
// asymmetric --leaf bevel that gives our CTAs their 3D lift) at header size,
// via the `.back-btn` class. Opaque so it reads on dark headers and the bright
// level-intro hero alike. Replaces the assorted bare/flat chevrons each screen
// used to hand-roll.
export const BackButton = ({
  onClick,
  label = "Back",
}: {
  onClick: () => void;
  label?: string;
}) => (
  <button type="button" className="back-btn" aria-label={label} onClick={onClick}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);

// Top header has been removed from the v2 prototype — the active tab in
// the bottom nav labels the screen, and ticket counts now live inline on
// the screens that actually need them (Shop, Profile). The component is
// kept as a no-op so existing call sites still compile without churn.
export const TopHeader = (props: { tickets?: number; title?: string }) => {
  void props;
  return null;
};

// Sound on/off toggle. Mute only silences the looping background track; SFX
// (taps, wins) still play — matching the underlying SoundManager. Reads the
// persisted state on mount so it stays hydration-safe.
export const SoundToggle = ({ size = 30 }: { size?: number }) => {
  // Hydration-safe read: server assumes "not muted", client reconciles to the
  // persisted value after mount and re-renders on every toggle.
  const muted = useSyncExternalStore(soundManager.subscribe, () => soundManager.isMuted, () => false);
  const toggle = () => {
    const next = soundManager.toggleMute();
    if (!next) playSound("click");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      aria-pressed={muted}
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 99, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", color: "#fff", cursor: "pointer", padding: 0 }}
    >
      <svg width={Math.round(size * 0.55)} height={Math.round(size * 0.55)} viewBox="0 0 24 24" fill="none">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9l5 5M21 9l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        ) : (
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </button>
  );
};

export const TabBar = ({ active = "home" }: { active?: string }) => {
  const proto = useProto();
  const onTab = (id: string) => {
    playSound("click");
    const map: Record<string, string> = {
      home: "home",
      levels: "levels",
      compete: "pass",
      shop: "shop",
      me: "profile",
    };
    proto.goto((map[id] || id) as Parameters<typeof proto.goto>[0]);
  };
  const tabs: { id: string; label: string; icon: ReactNode }[] = [
    {
      id: "home",
      label: "Home",
      icon: (
        <path
          d="M3 12l9-8 9 8v8a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          fill="none"
        />
      ),
    },
    {
      id: "levels",
      label: "Levels",
      icon: (
        <>
          <rect x="3" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
          <rect x="9" y="8" width="6" height="12" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
          <rect x="15" y="3" width="6" height="17" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
        </>
      ),
    },
    {
      id: "compete",
      label: "Compete",
      icon: (
        <>
          <path d="M7 4h10v3a5 5 0 0 1-10 0V4z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
          <path
            d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ),
    },
    {
      id: "shop",
      label: "Shop",
      icon: (
        <path
          d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 8zM8 8V6a4 4 0 0 1 8 0v2"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
      ),
    },
    {
      id: "me",
      label: "Me",
      icon: (
        <>
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M4 21c1-4 4-6 8-6s7 2 8 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ),
    },
  ];
  return (
    <div className="tab-bar" role="tablist" data-coach="tabbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          aria-label={t.label}
          className={"tab" + (t.id === active ? " active" : "")}
          onClick={() => onTab(t.id)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">{t.icon}</svg>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
};

export const InfoIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M12 11v5M12 7.5v.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

// A working circular "i" help button: opens a dismissible info dialog explaining
// the surrounding feature. Replaces the various decorative `i` glyphs that
// looked tappable but did nothing.
export const InfoButton = ({
  title,
  text,
  size = 30,
}: {
  title: string;
  text: string;
  size?: number;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`About ${title}`}
        onClick={() => setOpen(true)}
        style={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: 99,
          border: "1.5px solid rgba(253, 251, 246, 0.3)",
          background: "rgba(253, 251, 246, 0.06)",
          color: "rgba(253, 251, 246, 0.7)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-display)",
          fontSize: Math.round(size * 0.5),
          lineHeight: 1,
          // Keep the glyph a lowercase "i" even when placed inside an
          // uppercased label (e.g. a "POINTS" header).
          textTransform: "none",
        }}
      >
        i
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 320,
              background: "var(--surface-1)",
              border: "1px solid rgba(253, 251, 246, 0.12)",
              borderRadius: 18,
              padding: 20,
              boxShadow: "0 18px 44px rgba(0, 0, 0, 0.55)",
              textAlign: "left",
              // Reset inherited typography: this dialog can be rendered inside
              // an uppercased / letter-spaced label (e.g. a "POINTS" header),
              // which would otherwise transform the body copy.
              textTransform: "none",
              letterSpacing: "normal",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: "var(--ink-soft)" }}>{text}</div>
            <button
              type="button"
              className="pressable"
              onClick={() => setOpen(false)}
              style={{
                marginTop: 18,
                width: "100%",
                background: "var(--maple-500)",
                color: "var(--frame)",
                border: "2px solid var(--frame)",
                borderRadius: 12,
                padding: "10px 0",
                fontFamily: "var(--font-body)",
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: 0.3,
                textAlign: "center",
                boxShadow: "0 3px 0 var(--frame)",
                cursor: "pointer",
              }}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// A button that runs an optional action and flashes a transient toast — used
// for affordances whose full backend is out of prototype scope (partner
// offers, friend invites) so they give clear feedback instead of feeling dead.
export const ToastButton = ({
  toast,
  onClick,
  className,
  style,
  ariaLabel,
  children,
}: {
  toast: string;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children: ReactNode;
}) => {
  const [show, setShow] = useState(false);
  const fire = () => {
    onClick?.();
    setShow(true);
    window.setTimeout(() => setShow(false), 2200);
  };
  return (
    <>
      <button type="button" aria-label={ariaLabel} className={className} style={style} onClick={fire}>
        {children}
      </button>
      {show && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 96,
            transform: "translateX(-50%)",
            zIndex: 120,
            background: "var(--surface-2)",
            color: "var(--ink)",
            border: "1px solid rgba(253, 251, 246, 0.14)",
            borderRadius: 12,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 700,
            boxShadow: "0 10px 28px rgba(0, 0, 0, 0.5)",
            maxWidth: 280,
            textAlign: "center",
            // Reset inherited typography in case the trigger sits inside an
            // uppercased / letter-spaced label.
            textTransform: "none",
            letterSpacing: "normal",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
};

export const CategoryIcon = ({ name, size = 28 }: { name: string; size?: number }) => {
  const map: Record<string, ReactNode> = {
    Movies: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" />
        <circle cx="8" cy="9" r="1.2" fill="white" />
        <circle cx="16" cy="9" r="1.2" fill="white" />
        <circle cx="8" cy="15" r="1.2" fill="white" />
        <circle cx="16" cy="15" r="1.2" fill="white" />
      </>
    ),
    Sports: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="M12 3v18M3 12h18M5 5l14 14M19 5L5 19" stroke="white" strokeWidth="1.5" fill="none" />
      </>
    ),
    Crypto: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <text x="12" y="16" fontSize="11" fontWeight="900" fill="white" textAnchor="middle">
          ₿
        </text>
      </>
    ),
    History: (
      <>
        <rect x="4" y="6" width="16" height="14" rx="1.5" fill="currentColor" />
        <path d="M4 9h16M9 6V4h6v2" stroke="white" strokeWidth="1.5" fill="none" />
      </>
    ),
    Geography: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="white" strokeWidth="1.2" fill="none" />
      </>
    ),
    Science: (
      <>
        <path d="M9 3h6v5l4 10a2 2 0 0 1-1.8 3H6.8A2 2 0 0 1 5 18L9 8V3z" fill="currentColor" />
        <circle cx="11" cy="14" r="1" fill="white" />
        <circle cx="14" cy="16" r=".8" fill="white" />
      </>
    ),
    Music: (
      <>
        <path d="M9 18V6l10-2v12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="7" cy="18" r="2.5" fill="currentColor" />
        <circle cx="17" cy="16" r="2.5" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {map[name]}
    </svg>
  );
};

export const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  Movies: { bg: "#1e1e1e", fg: "#FB72FF" },
  Sports: { bg: "#1e1e1e", fg: "#00CFF2" },
  Crypto: { bg: "#1e1e1e", fg: "#FFC931" },
  History: { bg: "#1e1e1e", fg: "#F5BB1B" },
  Geography: { bg: "#1e1e1e", fg: "#00CFF2" },
  Science: { bg: "#1e1e1e", fg: "#FB72FF" },
  Music: { bg: "#1e1e1e", fg: "#FFC931" },
};

export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontFamily: "var(--font-display)",
      fontSize: 11,
      color: "rgba(255,255,255,.5)",
      letterSpacing: 1.2,
      marginBottom: 8,
      marginTop: 2,
    }}
  >
    {children}
  </div>
);

// ===== Surfaces & controls ====================================================

// Dark content card — the `#0F0F10` rounded panel used all over the app (shop
// rows, home tiles, profile sections). Pass `accent` for a colored hairline
// border, otherwise it falls back to the standard faint white edge.
export const Card = ({
  children,
  accent,
  radius = 16,
  pad = 14,
  glow = false,
  style,
}: {
  children: ReactNode;
  accent?: string;
  radius?: number;
  pad?: number | string;
  glow?: boolean;
  style?: CSSProperties;
}) => (
  <div
    style={{
      background: "#0F0F10",
      border: `1px solid ${accent ? `${accent}33` : "rgba(255,255,255,0.06)"}`,
      borderRadius: radius,
      padding: pad,
      ...(glow && accent ? { boxShadow: `0 0 24px ${accent}14` } : null),
      ...style,
    }}
  >
    {children}
  </div>
);

// Bottom sheet — self-contained dimmed backdrop + slide-up panel. Tapping the
// backdrop calls `onClose`; the panel stops propagation so taps inside don't
// dismiss. Replaces the per-screen sheet/backdrop pairs that had drifted apart
// (radius 22 vs 24, two different enter animations).
// Exit animation duration — kept in sync between the CSS and the unmount timer
// so the sheet finishes sliding out before the parent removes it.
const SHEET_EXIT_MS = 220;

export const Sheet = ({
  children,
  onClose,
  ariaLabel,
  accent = "var(--maple-500)",
  handle = true,
  zIndex = 30,
}: {
  // Children may be a render function receiving an animated `close` — wire it to
  // any in-sheet dismiss/cancel button so those also play the exit animation.
  children: ReactNode | ((close: () => void) => ReactNode);
  onClose?: () => void;
  ariaLabel: string;
  accent?: string;
  handle?: boolean;
  zIndex?: number;
}) => {
  const [closing, setClosing] = useState(false);
  // Animate out, then tell the parent to unmount after the slide finishes. No-op
  // when onClose is absent (e.g. a sheet that disables dismissal mid-action).
  const close = useCallback(() => {
    if (!onClose) return;
    setClosing(true);
    window.setTimeout(onClose, SHEET_EXIT_MS);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={close}
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        background: "rgba(0,0,0,0.62)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        animation: `${closing ? "waffles-v2-backdrop-out" : "waffles-v2-backdrop-in"} ${SHEET_EXIT_MS}ms ease forwards`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: "var(--surface-1)",
          borderTop: `2px solid ${accent}`,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "18px 18px max(20px, env(safe-area-inset-bottom))",
          animation: closing
            ? `waffles-v2-slideDown ${SHEET_EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1) forwards`
            : "waffles-v2-slideUp 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {handle && <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 99, background: "rgba(253,251,246,0.2)", margin: "0 auto 14px" }} />}
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
};

// Dialog/sheet action button — the chunky framed button used in confirmation
// sheets (distinct from the big screen `.cta`). `primary` fills with an accent
// and carries the 3D hard-shadow lift; `ghost` is the outlined cancel; `danger`
// is the destructive fill. Anything else (icons, labels) goes in `children`.
export const Button = ({
  children,
  onClick,
  variant = "primary",
  accent = "var(--maple-500)",
  flex,
  disabled,
  ariaLabel,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  accent?: string;
  flex?: number;
  disabled?: boolean;
  ariaLabel?: string;
  style?: CSSProperties;
}) => {
  const base: CSSProperties = {
    flex,
    fontFamily: "var(--font-body)",
    fontWeight: 900,
    fontSize: 14,
    padding: "12px 0",
    borderRadius: 12,
    letterSpacing: 0.3,
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    opacity: disabled ? 0.5 : 1,
  };
  const variantStyle: CSSProperties =
    variant === "ghost"
      ? { background: "transparent", border: "2px solid var(--frame)", color: "var(--ink)" }
      : variant === "danger"
        ? { background: "var(--live-red)", border: "2px solid var(--frame)", color: "#fff", boxShadow: "0 4px 0 var(--frame)" }
        : { background: accent, border: "2px solid var(--frame)", color: "var(--frame)", boxShadow: "0 4px 0 var(--frame)" };
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel} style={{ ...base, ...variantStyle, ...style }}>
      {children}
    </button>
  );
};

// Sticky bottom action bar with a single primary CTA — the recurring
// bottom-of-screen action (results, level intro, leaderboard…). The button is
// the chunky brand `.cta`; `flex: 0 1 95%` (centered) makes it 95% wide instead
// of edge-to-edge — `.cta`'s own `flex: 1` would otherwise stretch it full.
export const BottomCTA = ({
  label,
  onClick,
  tone = "maple",
  ariaLabel,
  disabled,
}: {
  label: ReactNode;
  onClick: () => void;
  tone?: "maple" | "berry";
  ariaLabel?: string;
  disabled?: boolean;
}) => (
  <div className="bottom-bar">
    <div className="cta-row" style={{ justifyContent: "center" }}>
      <button
        type="button"
        className={`cta ${tone}`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        style={{ flex: "0 1 95%", opacity: disabled ? 0.5 : 1 }}
      >
        {label}
      </button>
    </div>
  </div>
);
