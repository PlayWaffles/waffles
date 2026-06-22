"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TicketIcon, PixelImg, resolveAvatar } from "@/player/shared";
import tactile from "./tactile.module.css";

// ---------------------------------------------------------------------------
// Tournament-card design lab — four directions, same mock data, side by side.
// Wrapped in `.waffles-v2[data-theme="world-cup"]` so tokens + the green
// football skin match the real Home screen exactly. Pure/presentational: no
// proto, no server, no app providers.
// ---------------------------------------------------------------------------

const MOCK = {
  title: "World Cup Royale #054",
  format: "Football trivia",
  // The actual prize pool, computed (here mocked) in tickets. In the real card
  // this is round.prizePoolUsdc / USDT_PER_TICKET — grows as players enter.
  prizePool: 25,
  // Capped field — drives the scarcity meter. 80/100 = 20 spots left.
  spotsFilled: 80,
  spotsTotal: 100,
  joinedToday: 23,
  entryCost: 1,
};

/** Shared ticking HH:MM:SS countdown (the ticket-window closing clock). */
function useCountdown(initial = 3600 + 3 * 60 + 44) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 0 ? initial : s - 1)), 1000);
    return () => clearInterval(id);
  }, [initial]);
  const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const BoltIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
  </svg>
);

const LiveDot = ({ color = "#FC1919" }: { color?: string }) => (
  <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: color, boxShadow: `0 0 0 4px ${color}33`, animation: "waffles-v2-pulse 1.5s infinite" }} />
);

// The two restored accent lines: green skill cue + yellow first-game bonus.
const Accents = ({ mt = 10 }: { mt?: number }) => (
  <div style={{ marginTop: mt, display: "flex", flexDirection: "column", gap: 5 }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--leaf)" }}>
      <BoltIcon />Fastest correct answers win
    </span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--maple-500)" }}>
      <BoltIcon />2× XP on your first game today
    </span>
  </div>
);

// Scarcity meter — colour heats up as the field fills so a near-full round
// screams "get in now": healthy (leaf) → filling (amber) → almost gone (red).
function spotsColor(ratio: number) {
  if (ratio >= 0.85) return "#FC1919";
  if (ratio >= 0.6) return "#F5A91B";
  return "var(--leaf)";
}

/** Vertical capacity gauge — a slim bottom-up fill + label. `compact` shows
 *  only "<n> spots left" (the joined count is carried by the avatars). */
function SpotsBarV({ height = 62, compact = false }: { height?: number; compact?: boolean }) {
  const { spotsFilled: f, spotsTotal: t } = MOCK;
  const ratio = f / t;
  const col = spotsColor(ratio);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <div style={{ width: 9, height, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        <div style={{ width: "100%", height: `${ratio * 100}%`, borderRadius: 99, background: col, boxShadow: `0 0 8px ${col}66` }} />
      </div>
      {compact ? (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, color: col, lineHeight: 1 }}>{t - f}</div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: "rgba(255,255,255,.45)", textTransform: "uppercase", marginTop: 3 }}>spots left</div>
        </div>
      ) : (
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "#fff", lineHeight: 1 }}>
            {f}<span style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>/{t}</span>
          </div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: "rgba(255,255,255,.45)", textTransform: "uppercase", marginTop: 3 }}>spots filled</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: col, marginTop: 3 }}>{t - f} left</div>
        </div>
      )}
    </div>
  );
}

const CARD_BG = "#0F0F10";
const CARD_SHADOW = "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)";

// Stacked join PFPs. Uses the real avatar set (resolveAvatar → 1 of 8 animal
// pfps, deterministic per seed) — swap seeds for real userIds/usernames when
// wired to live data. Overlapping circles + "<n> joined today".
const JOIN_SEEDS = ["maya", "leo", "ada", "kai", "zoe", "sam"];
function JoinedAvatars({ show = 4, size = 26, others = false }: { show?: number; size?: number; others?: boolean }) {
  const seeds = JOIN_SEEDS.slice(0, show);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <div style={{ display: "flex" }}>
        {seeds.map((seed, i) => (
          <PixelImg
            key={seed}
            src={resolveAvatar(null, seed)}
            size={size}
            alt=""
            style={{ borderRadius: 99, border: `2px solid ${CARD_BG}`, objectFit: "cover", background: "#1c1c1f", marginLeft: i === 0 ? 0 : -size * 0.34, position: "relative", zIndex: show - i }}
          />
        ))}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,.6)" }}>
        {others ? "and " : ""}<span style={{ color: "#fff" }}>{MOCK.spotsFilled}</span> {others ? "others joined today" : "joined today"}
      </span>
    </div>
  );
}

// ===========================================================================
// V3 — Compact Banner
// ===========================================================================
function CompactBanner({ timer }: { timer: string }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 16, padding: "13px 14px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <LiveDot />
        <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 0.7, color: "#FC1919", textTransform: "uppercase" }}>Tickets closing in</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "#FC1919", fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>{timer}</span>
      </div>
      {/* Title (prominent) on the left, prize pool as a right-aligned stat
          using the open space on that side. */}
      <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <span style={{ flex: 1, fontFamily: "var(--font-display)", fontSize: 25, color: "#fff", lineHeight: 1.03 }}>{MOCK.title}</span>
        {/* Prize pool as a quiet supporting stat (label over number) so it
            doesn't compete with the title for the eye. */}
        <div style={{ textAlign: "right", flexShrink: 0, paddingTop: 2 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 3 }}>prize pool</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <TicketIcon size={15} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "rgba(255,255,255,.92)", lineHeight: 1 }}>{MOCK.prizePool}</span>
          </div>
        </div>
      </div>
      <Accents mt={9} />
      {/* Joined PFPs (the "filled" label) + scarcity bar + spots-left */}
      <div style={{ marginTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
          <JoinedAvatars show={4} size={24} />
          <span style={{ fontSize: 11, fontWeight: 800, color: spotsColor(MOCK.spotsFilled / MOCK.spotsTotal) }}>{MOCK.spotsTotal - MOCK.spotsFilled} spots left</span>
        </div>
        <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(MOCK.spotsFilled / MOCK.spotsTotal) * 100}%`, borderRadius: 99, background: spotsColor(MOCK.spotsFilled / MOCK.spotsTotal), boxShadow: `0 0 8px ${spotsColor(MOCK.spotsFilled / MOCK.spotsTotal)}66` }} />
        </div>
      </div>
      <button type="button" className={tactile.cta} style={{ marginTop: 11, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, background: "linear-gradient(180deg, #FFD24D, #F5A91B)", color: "#3a2a00", border: "none", borderRadius: 12, padding: "11px", fontFamily: "var(--font-display)", fontSize: 14, cursor: "pointer" }}>
        Enter <TicketIcon size={14} />{MOCK.entryCost}
      </button>
    </div>
  );
}

// ===========================================================================
// V4 — Prize-Forward Bold
// ===========================================================================
function PrizeForward({ timer }: { timer: string }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", boxShadow: CARD_SHADOW }}>
      {/* Two columns: info (closing + title + accents) left, prize pool +
          scarcity occupying the open space on the right. */}
      <div style={{ display: "flex", gap: 14, justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <LiveDot />
            <span style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 0.7, color: "#FC1919", textTransform: "uppercase" }}>Tickets closing in</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "#FC1919", fontVariantNumeric: "tabular-nums", letterSpacing: 0.5 }}>{timer}</span>
          </div>
          <div style={{ marginTop: 9, fontFamily: "var(--font-display)", fontSize: 21, lineHeight: 1.05, color: "#fff" }}>{MOCK.title}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 600, marginTop: 2 }}>{MOCK.format}</div>
          <Accents mt={9} />
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 13 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, color: "var(--maple-500)", textTransform: "uppercase", marginBottom: 3 }}>prize pool</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <TicketIcon size={28} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "#fff", lineHeight: 0.9 }}>{MOCK.prizePool}</span>
            </div>
          </div>
          <SpotsBarV height={46} compact />
        </div>
      </div>
      {/* Joined PFPs — faces first, then the "and N others" social proof */}
      <div style={{ marginTop: 14 }}>
        <JoinedAvatars show={5} size={27} others />
      </div>
      <button type="button" className={tactile.cta} style={{ marginTop: 12, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "linear-gradient(180deg, #FFD24D, #F5A91B)", color: "#3a2a00", border: "none", borderRadius: 13, padding: "13px", fontFamily: "var(--font-display)", fontSize: 16, cursor: "pointer" }}>
        <TicketIcon size={18} />Buy ticket · {MOCK.entryCost}
      </button>
    </div>
  );
}

// ===========================================================================
// Layout
// ===========================================================================
function Slot({ tag, name, note, children }: { tag: string; name: string; note: string; children: ReactNode }) {
  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--maple-500)" }}>{tag}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "#fff" }}>{name}</span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,.45)", fontWeight: 600 }}>{note}</p>
      {children}
    </div>
  );
}

export default function TournamentCardPreview() {
  const timer = useCountdown();
  return (
    <div className="waffles-v2" data-theme="world-cup" style={{ minHeight: "100dvh", background: "#000", padding: "32px 20px 80px" }}>
      <header style={{ maxWidth: 1080, margin: "0 auto 28px" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "#fff", margin: 0 }}>Tournament card — 4 directions</h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>
          Same data, four takes. All tap to open the entry sheet. Football skin + real tokens.
        </p>
      </header>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 28, justifyItems: "center" }}>
        <Slot tag="V3" name="Compact Banner" note="Shortest layout. Explicit pill button instead of whole-card tap. Densest.">
          <CompactBanner timer={timer} />
        </Slot>
        <Slot tag="V4" name="Prize-Forward" note="Marketing-led: big prize-pool number hero + full-width Buy button. Tallest.">
          <PrizeForward timer={timer} />
        </Slot>
      </div>
    </div>
  );
}
