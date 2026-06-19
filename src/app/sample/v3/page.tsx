"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CORE_FORMATS, EXPANSION_FORMATS, getFormat, type FormatDef } from "./data";
import { GameShell } from "./components/GameShell";
import { FormatRunner } from "./components/FormatRunner";
import { TimedList } from "./components/TimedList";
import { MapClick } from "./components/MapClick";
import { Ordering } from "./components/Ordering";
import { Bingo } from "./components/Bingo";
import { Crossword } from "./components/Crossword";

const ACCENT_HEX: Record<FormatDef["accent"], string> = {
  gold: "#FFC931",
  purple: "#C644FF",
  cyan: "#4DA8F7",
  green: "#81C784",
};

export default function V3Page() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ? getFormat(activeId) : null;

  // Deep-link support: /sample/v3?f=<format-id> opens straight into a format.
  // One-shot read on mount (can't run in a state initializer without an SSR
  // hydration mismatch), so the setState-in-effect here is intentional.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("f");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f && getFormat(f)) setActiveId(f);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-[var(--brand-black)] text-white">
      <Gallery onOpen={setActiveId} />
      <AnimatePresence>
        {active ? (
          <GameShell
            key={active.id}
            title={active.name}
            subtitle={`#${active.num} · ${active.tier === "core" ? "Core format" : "Expansion"}`}
            onExit={() => setActiveId(null)}
          >
            <FormatStage format={active} onExit={() => setActiveId(null)} />
          </GameShell>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function FormatStage({ format, onExit }: { format: FormatDef; onExit: () => void }) {
  switch (format.engine) {
    case "choice":
    case "set":
      return <FormatRunner format={format} onExit={onExit} />;
    case "timed-list":
      return <TimedList onExit={onExit} />;
    case "map":
      return <MapClick onExit={onExit} />;
    case "ordering":
      return <Ordering onExit={onExit} />;
    case "bingo":
      return <Bingo onExit={onExit} />;
    case "crossword":
      return <Crossword onExit={onExit} />;
    default:
      return null;
  }
}

function Gallery({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
      <header className="mb-7 text-center">
        <div className="mb-2 text-4xl">🏆⚽</div>
        <h1 className="font-body text-[34px] leading-none tracking-[-0.02em]">World Cup Format Lab</h1>
        <p className="mt-2 font-display text-[13px] uppercase tracking-[0.15em] text-white/45">
          17 trivia formats · tap to play
        </p>
      </header>

      <SectionHeader title="Ready now" count={CORE_FORMATS.length} note="Run on today's engine" />
      <div className="mb-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {CORE_FORMATS.map((f) => (
          <FormatCard key={f.id} format={f} onOpen={onOpen} />
        ))}
      </div>

      <SectionHeader title="Expansion" count={EXPANSION_FORMATS.length} note="New UI · bigger build" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {EXPANSION_FORMATS.map((f) => (
          <FormatCard key={f.id} format={f} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, count, note }: { title: string; count: number; note: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="font-body text-[18px] text-white">{title}</h2>
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-waffle-gold px-1.5 font-body text-[12px] text-[#1e1e1e]">
        {count}
      </span>
      <span className="ml-auto font-display text-[11px] uppercase tracking-wider text-white/35">{note}</span>
    </div>
  );
}

function FormatCard({ format, onOpen }: { format: FormatDef; onOpen: (id: string) => void }) {
  const accent = ACCENT_HEX[format.accent];
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(format.id)}
      whileTap={{ scale: 0.97 }}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
    >
      <span
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-body text-[17px]"
        style={{ background: `${accent}1f`, color: accent, border: `1.5px solid ${accent}55` }}
      >
        {format.num}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[16px] leading-tight text-white">{format.name}</span>
        <span className="block truncate font-display text-[12px] leading-snug text-white/50">
          {format.tagline}
        </span>
        {format.mediaNote ? (
          <span className="mt-1 inline-block rounded-full bg-white/8 px-2 py-0.5 font-display text-[9px] uppercase tracking-wider text-white/45">
            {format.mediaNote}
          </span>
        ) : null}
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 text-white/30">
        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}
