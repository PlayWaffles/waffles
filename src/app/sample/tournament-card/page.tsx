"use client";

import { useEffect, useState, type ReactNode } from "react";
import { TicketIcon } from "@/player/shared";

// ---------------------------------------------------------------------------
// Tournament-card design lab — four directions, same mock data, side by side.
// Wrapped in `.waffles-v2[data-theme="world-cup"]` so tokens + the green
// football skin match the real Home screen exactly. Pure/presentational: no
// proto, no server, no app providers.
// ---------------------------------------------------------------------------

const MOCK = {
  title: "World Cup Royale #054",
  format: "Football trivia · 6 questions",
  poolHeadline: "Winner takes the pool",
  prizeTickets: 25,
  players: 2,
  joinedToday: 23,
  entryCost: 1,
};

/** Shared ticking mm:ss countdown (starts at 44:42). */
function useCountdown(initial = 44 * 60 + 42) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s <= 0 ? initial : s - 1)), 1000);
    return () => clearInterval(id);
  }, [initial]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const ArrowIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LiveDot = ({ color = "#FC1919" }: { color?: string }) => (
  <div style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: color, boxShadow: `0 0 0 4px ${color}33`, animation: "waffles-v2-pulse 1.5s infinite" }} />
);

const CARD_BG = "#0F0F10";
const CARD_SHADOW = "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)";

// ===========================================================================
// V1 — Lean Hook (current production build)
// ===========================================================================
function LeanHook({ timer }: { timer: string }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", boxShadow: CARD_SHADOW, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
        <LiveDot />
        <div className="chip" style={{ background: "rgba(252,25,25,.15)", color: "#FC1919", padding: "3px 10px", fontSize: 11, border: "1px solid rgba(252,25,25,.3)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>KICKOFF IN {timer}</div>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 25, lineHeight: 1.05, color: "#fff" }}>{MOCK.title}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.55)", fontWeight: 600, marginTop: 2 }}>{MOCK.format} · 60s</div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 9 }}>
        <TicketIcon size={20} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff", lineHeight: 1 }}>{MOCK.poolHeadline}</span>
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>
          <LiveDot color="var(--leaf)" />
          {MOCK.players} playing now
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontSize: 13, color: "var(--maple-500)" }}>
          <TicketIcon size={14} />{MOCK.entryCost} to enter
          <ArrowIcon />
        </span>
      </div>
      <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.08, transform: "rotate(15deg)" }}>
        <div className="waffle-mark" style={{ width: 120, height: 120, borderRadius: 24 }} />
      </div>
    </div>
  );
}

// ===========================================================================
// V2 — Ticket Stub (physical admission-ticket aesthetic, horizontal)
// ===========================================================================
function TicketStub({ timer }: { timer: string }) {
  const notch = (side: "left" | "right") => (
    <div style={{ position: "absolute", [side]: -9, top: "50%", width: 18, height: 18, marginTop: -9, borderRadius: 99, background: "#000" }} />
  );
  return (
    <div style={{ position: "relative", display: "flex", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,201,49,.35)", boxShadow: CARD_SHADOW, cursor: "pointer", minHeight: 150 }}>
      {/* Left stub */}
      <div style={{ width: 104, flexShrink: 0, background: "linear-gradient(160deg, #FFC931, #F5A91B)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, color: "#3a2a00" }}>
        <TicketIcon size={34} />
        <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", opacity: 0.85 }}>Admit one</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1, display: "inline-flex", alignItems: "center", gap: 3 }}>{MOCK.entryCost}</div>
      </div>
      {/* Perforation */}
      <div style={{ position: "relative", width: 0, borderLeft: "2px dashed rgba(255,201,49,.4)" }}>
        {notch("left")}
        {notch("right")}
      </div>
      {/* Right body */}
      <div style={{ flex: 1, background: CARD_BG, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <LiveDot />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#FC1919", textTransform: "uppercase" }}>Kickoff in {timer}</span>
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1.05, color: "#fff" }}>{MOCK.title}</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 600 }}>{MOCK.format}</div>
        <div style={{ marginTop: 2, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-display)", fontSize: 14, color: "var(--maple-500)" }}>
          <TicketIcon size={15} />{MOCK.poolHeadline}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// V3 — Compact Banner (two rows, explicit pill button)
// ===========================================================================
function CompactBanner({ timer }: { timer: string }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 16, padding: "13px 14px", border: "1px solid rgba(255,255,255,0.06)", boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <LiveDot />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "#fff", lineHeight: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{MOCK.title}</span>
        <div style={{ flex: 1 }} />
        <span className="chip" style={{ background: "rgba(252,25,25,.15)", color: "#FC1919", padding: "2px 8px", fontSize: 10, fontWeight: 800, border: "1px solid rgba(252,25,25,.3)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{timer}</span>
      </div>
      <div style={{ marginTop: 11, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 800, color: "rgba(255,255,255,.75)" }}>
          <TicketIcon size={15} />{MOCK.poolHeadline}
        </span>
        <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "linear-gradient(180deg, #FFD24D, #F5A91B)", color: "#3a2a00", border: "none", borderRadius: 99, padding: "7px 14px", fontFamily: "var(--font-display)", fontSize: 13, boxShadow: "0 3px 0 rgba(0,0,0,.3)", cursor: "pointer", flexShrink: 0 }}>
          Enter <TicketIcon size={14} />{MOCK.entryCost}
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// V4 — Prize-Forward Bold (big number hero + full-width button)
// ===========================================================================
function PrizeForward({ timer }: { timer: string }) {
  return (
    <div style={{ background: CARD_BG, borderRadius: 18, padding: 18, position: "relative", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <LiveDot />
        <span className="chip" style={{ background: "rgba(252,25,25,.15)", color: "#FC1919", padding: "3px 10px", fontSize: 11, border: "1px solid rgba(252,25,25,.3)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>KICKOFF IN {timer}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.5)", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <LiveDot color="var(--leaf)" />{MOCK.players} in
        </span>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, lineHeight: 1.05, color: "#fff" }}>{MOCK.title}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", fontWeight: 600, marginTop: 2 }}>{MOCK.format}</div>
      {/* Prize hero */}
      <div style={{ marginTop: 14, borderRadius: 14, border: "1px solid rgba(255,201,49,.25)", background: "radial-gradient(120% 120% at 0% 0%, rgba(255,201,49,.16), rgba(255,201,49,.04))", padding: "14px 15px" }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: "var(--maple-500)", textTransform: "uppercase" }}>Top prize</div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <TicketIcon size={34} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 40, color: "#fff", lineHeight: 0.9 }}>{MOCK.prizeTickets}</span>
        </div>
        <div style={{ marginTop: 5, fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)" }}>{MOCK.poolHeadline} · {MOCK.joinedToday} joined today</div>
      </div>
      <button type="button" style={{ marginTop: 13, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, background: "linear-gradient(180deg, #FFD24D, #F5A91B)", color: "#3a2a00", border: "none", borderRadius: 13, padding: "13px", fontFamily: "var(--font-display)", fontSize: 16, boxShadow: "0 4px 0 rgba(0,0,0,.3)", cursor: "pointer" }}>
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
        <Slot tag="V1" name="Lean Hook" note="Current build. Minimal: status+countdown, title, one prize promise, footer CTA. Detail lives in the sheet.">
          <LeanHook timer={timer} />
        </Slot>
        <Slot tag="V2" name="Ticket Stub" note="Physical admission-ticket look. Gold stub (cost) + perforation + event body. Most branded.">
          <TicketStub timer={timer} />
        </Slot>
        <Slot tag="V3" name="Compact Banner" note="Two rows, shortest of all. Explicit pill button instead of whole-card tap. Densest.">
          <CompactBanner timer={timer} />
        </Slot>
        <Slot tag="V4" name="Prize-Forward" note="Marketing-led: big prize number hero + full-width Buy button. Shows the number; tallest.">
          <PrizeForward timer={timer} />
        </Slot>
      </div>
    </div>
  );
}
