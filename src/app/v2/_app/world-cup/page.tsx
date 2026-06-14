"use client";

import { useEffect, useState } from "react";
import { Phone } from "../shared";
import { CORE_FORMATS, EXPANSION_FORMATS, getFormat, type FormatDef } from "./data";
import { ACCENT } from "./components/parts";
import { FormatRunner } from "./components/runner";
import { Bingo, MapClick, Ordering } from "./components/expansion";

export default function WorldCupPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? getFormat(activeId) : null;

  // Deep-link: /world-cup?f=<format-id>. One-shot read on mount.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("f");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f && getFormat(f)) setActiveId(f);
  }, []);

  return (
    <div className="waffles-v2 waffles-v2-stage">
      <div className="waffles-v2-frame">
        {active ? (
          <FormatStage format={active} onExit={() => setActiveId(null)} />
        ) : (
          <Gallery onOpen={setActiveId} />
        )}
      </div>
    </div>
  );
}

function FormatStage({ format, onExit }: { format: FormatDef; onExit: () => void }) {
  switch (format.engine) {
    case "choice":
    case "set":
      return <FormatRunner format={format} onExit={onExit} />;
    case "map":
      return <MapClick onExit={onExit} />;
    case "ordering":
      return <Ordering onExit={onExit} />;
    case "bingo":
      return <Bingo onExit={onExit} />;
    default:
      return null;
  }
}

function Gallery({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <Phone statusDark>
      <div className="bg-deep" />
      <div className="glow-top" style={{ height: 260 }} />
      <div style={{ position: "relative", zIndex: 2, height: "100%", overflowY: "auto", padding: "28px 16px 28px" }}>
        <header style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 38 }}>🏆⚽</div>
          <h1 style={{ fontFamily: "var(--font-hero)", fontSize: 32, color: "#fff", lineHeight: 1.05, marginTop: 4 }}>World Cup Format Lab</h1>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,.45)", marginTop: 6 }}>17 trivia formats · tap to play</p>
        </header>

        <SectionHeader title="Ready now" count={CORE_FORMATS.length} note="Today's engine" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {CORE_FORMATS.map((f) => <FormatCard key={f.id} format={f} onOpen={onOpen} />)}
        </div>

        <SectionHeader title="Expansion" count={EXPANSION_FORMATS.length} note="New UI" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {EXPANSION_FORMATS.map((f) => <FormatCard key={f.id} format={f} onOpen={onOpen} />)}
        </div>
      </div>
    </Phone>
  );
}

function SectionHeader({ title, count, note }: { title: string; count: number; note: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "#fff" }}>{title}</h2>
      <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 99, background: "#FFC931", color: "#191919", fontFamily: "var(--font-display)", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
      <span style={{ marginLeft: "auto", fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,.35)" }}>{note}</span>
    </div>
  );
}

function FormatCard({ format, onOpen }: { format: FormatDef; onOpen: (id: string) => void }) {
  const accent = ACCENT[format.accent];
  return (
    <button
      type="button"
      onClick={() => onOpen(format.id)}
      className="card pressable"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, textAlign: "left", cursor: "pointer", width: "100%" }}
    >
      <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 17, background: `${accent}22`, color: accent, border: `1.5px solid ${accent}66` }}>{format.num}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 16, color: "#fff", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{format.name}</span>
        <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{format.tagline}</span>
        {format.mediaNote ? (
          <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,.08)", fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>{format.mediaNote}</span>
        ) : null}
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: "rgba(255,255,255,.3)" }}>
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
