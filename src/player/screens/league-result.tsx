"use client";

import { ASSETS, PixelImg, SyrupIcon } from "../shared";
import type { LeagueResult } from "@/lib/player/leagues";

// Season-start "here's how you did" moment, shown once after a league season is
// settled (promotion/demotion + earned rewards). Gated per-season in
// localStorage so each weekly result shows exactly once.

const KEY = (season: string) => `waffles.v2.leagueResultSeen.${season}`;
export const hasSeenLeagueResult = (season: string): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEY(season)) === "1";
  } catch {
    return true;
  }
};
const markSeen = (season: string) => {
  try {
    localStorage.setItem(KEY(season), "1");
  } catch {
    /* storage disabled */
  }
};

const MEDAL_BY_COLOR: Record<string, string> = {
  "#cd7f32": ASSETS.medalApprentice,
  "#bfc7d0": ASSETS.medalSilver,
  "#9aa6b3": ASSETS.medalAdvanced,
  "#3ddbb8": ASSETS.medalGenius,
  "#FFD24D": ASSETS.medalMaster,
};
const medalFor = (color: string) => MEDAL_BY_COLOR[color] ?? ASSETS.medalApprentice;

const POWERUP_LABEL: Record<string, string> = {
  FIFTY_FIFTY: "50:50",
  EXTRA_TIME: "Extra Time",
  SKIP: "Skip",
  SHIELD: "Shield",
};

// Outcome → headline + accent. Stayed still celebrates a completed season.
const OUTCOME = {
  PROMOTED: { kicker: "Promoted", headline: "You moved up!", accent: "#3dd17a" },
  DEMOTED: { kicker: "Relegated", headline: "Dropped a league", accent: "#ff6b6b" },
  STAYED: { kicker: "Season complete", headline: "You held your league", accent: "var(--maple-500)" },
} as const;

export const LeagueResultTakeover = ({ result, onClose }: { result: LeagueResult; onClose: () => void }) => {
  const o = OUTCOME[result.outcome];
  const moved = result.outcome !== "STAYED";
  const dismiss = () => {
    markSeen(result.season);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your league season result"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #1a1410 0%, #0a0805 100%)",
        animation: "waffles-v2-onb-in 0.35s var(--ease-out-quart)",
      }}
    >
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320, background: "radial-gradient(ellipse at center top, rgba(255,210,77,.22), transparent 65%)", pointerEvents: "none" }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, color: o.accent, textTransform: "uppercase", marginBottom: 10 }}>{o.kicker}</div>

        {/* From → To medals (single medal when the player stayed). */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 14 }}>
          {moved ? (
            <>
              <PixelImg src={medalFor(result.from.color)} size={72} alt={result.from.label} style={{ opacity: 0.55 }} />
              <span style={{ fontSize: 26, color: o.accent }} aria-hidden>{result.outcome === "PROMOTED" ? "▲" : "▼"}</span>
              <PixelImg src={medalFor(result.to.color)} size={104} alt={result.to.label} style={{ filter: `drop-shadow(0 0 26px ${o.accent})` }} />
            </>
          ) : (
            <PixelImg src={medalFor(result.to.color)} size={112} alt={result.to.label} style={{ filter: "drop-shadow(0 0 26px rgba(255,210,77,.5))" }} />
          )}
        </div>

        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 34, lineHeight: 1.04, color: "#fff", marginBottom: 8 }}>{o.headline}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 0.5, color: o.accent, marginBottom: 6 }}>{result.to.label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.6)", marginBottom: 22 }}>
          You finished <b style={{ color: "#fff" }}>#{result.rank}</b>
          {result.cohortSize > 0 ? ` of ${result.cohortSize}` : ""} last season.
        </div>

        {/* Earned rewards, if the finishing rank was in the paid range. */}
        {result.reward && (
          <div style={{ width: "100%", maxWidth: 320, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "rgba(255,255,255,.5)", marginBottom: 10 }}>YOUR REWARDS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {result.reward.syrup > 0 && (
                <span style={pillStyle}><SyrupIcon size={14} /> {result.reward.syrup.toLocaleString()}</span>
              )}
              {result.reward.powerUps.map((p) => (
                <span key={p.kind} style={pillStyle}>⚡ {p.n}× {POWERUP_LABEL[p.kind] ?? p.kind}</span>
              ))}
              {result.reward.boost && (
                <span style={pillStyle}>✨ {result.reward.boost.charges}× 2× XP</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "0 18px max(20px, env(safe-area-inset-bottom))", position: "relative", zIndex: 1 }}>
        <button type="button" className="cta maple" onClick={dismiss} style={{ width: "100%", flex: "none" }}>
          {moved ? "LET’S GO" : "CONTINUE"}
        </button>
      </div>
    </div>
  );
};

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(255,255,255,.07)",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 13,
  fontWeight: 800,
  color: "#fff",
  fontVariantNumeric: "tabular-nums",
};
