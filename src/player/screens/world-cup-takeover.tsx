"use client";

import { useEffect, useState } from "react";
import { TOURNAMENT_TOP_PRIZE, usdtLabel } from "../state";
import { ASSETS, PixelImg } from "../shared";

// Season welcome — the *moment* the World Cup goes live. The World Cup is the
// default season for everyone (not opt-in), so this is a celebratory intro, not
// a gate: a single "Let's go" dismisses it. Shown once (gated in localStorage);
// the announcement bell entry reopens it anytime.

const KEY = "waffles.v2.wcTakeoverSeen";
export const hasSeenWorldCupTakeover = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* storage disabled */
  }
};

const PERKS: { icon: string; text: string }[] = [
  { icon: "⚽", text: "Football trivia, refreshed daily" },
  { icon: "🔀", text: "New question formats — pick, order & more" },
  { icon: "⏱️", text: "Live tournaments every hour" },
  { icon: "🏆", text: `Win up to ${usdtLabel(TOURNAMENT_TOP_PRIZE)} in real prizes` },
];

export const WorldCupTakeover = ({ onClose }: { onClose: () => void }) => {
  // The theme is already the World Cup by default — this just dismisses the
  // welcome (and records it so it doesn't auto-show again).
  const dismiss = () => {
    markSeen();
    onClose();
  };

  // Live countdown to the next top-of-the-hour kickoff.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const ms = Math.max(0, next.getTime() - now);
  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="World Cup season is live"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        // World Cup palette baked in (the app theme is still default when this
        // shows, so we can't rely on the [data-theme] vars yet).
        background: "linear-gradient(180deg, #0c2017 0%, #05130b 100%)",
        animation: "waffles-v2-onb-in 0.35s var(--ease-out-quart)",
      }}
    >
      {/* Festive top glow + confetti-dot texture */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320, background: "radial-gradient(ellipse at center top, rgba(255,201,49,.28), transparent 65%)", pointerEvents: "none" }} />
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320, backgroundImage: "radial-gradient(circle, #FFC931 2px, transparent 2.5px), radial-gradient(circle, #2bbf5b 2px, transparent 2.5px), radial-gradient(circle, #fff 1.5px, transparent 2px)", backgroundSize: "80px 80px, 100px 100px, 70px 70px", backgroundPosition: "0 0, 30px 40px, 50px 20px", opacity: 0.4, pointerEvents: "none" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px", position: "relative", zIndex: 1 }}>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <PixelImg src={ASSETS.trophy} size={128} alt="" style={{ filter: "drop-shadow(0 0 30px rgba(255,201,49,.55))", animation: "waffles-v2-lvl-trophy-float 3.2s ease-in-out infinite" }} />
          <span style={{ position: "absolute", right: -6, bottom: 2, fontSize: 40, filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))" }} aria-hidden>⚽</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 8 }}>Season is live</div>
        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 40, lineHeight: 1.02, color: "#fff", marginBottom: 10 }}>
          The World Cup<br />comes to Waffles
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 800, color: "#fff" }}>📅 Jun 11 – Jul 19</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,201,49,.14)", border: "1px solid rgba(255,201,49,.4)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 800, color: "var(--maple-500)", fontVariantNumeric: "tabular-nums" }}>⏱️ Next kickoff {mm}:{ss}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,.6)", marginBottom: 24, maxWidth: 300 }}>
          A whole new season of football trivia. Play live, climb the table, win real prizes.
        </div>

        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          {PERKS.map((p) => (
            <div key={p.text} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: "10px 14px", textAlign: "left" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden>{p.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 18px max(20px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
        <button type="button" className="cta maple" onClick={dismiss} style={{ width: "100%", flex: "none" }}>
          LET&apos;S GO
        </button>
      </div>
    </div>
  );
};
