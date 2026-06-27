"use client";

/**
 * Sample page: Winners graphic
 *
 * Visit /sample/winners to preview.
 *
 * A celebratory "here are the winners" graphic for a settled tournament — built
 * to feel like a shareable victory card:
 *   1. Staged reveal: prize pool → podium rises (3rd → 2nd → 1st) → runners-up cascade
 *   2. A gold-lit 3-place podium with crowned champion, medals + prize per place
 *   3. Real-style prize split (the app's bracket shares) shown in USDT
 *   4. Runners-up (4th–8th) list, then a Share CTA
 *   5. Confetti + shimmer on the champion
 */

import { useState } from "react";
import { motion } from "framer-motion";

// =============================================================================
// MOCK DATA
// =============================================================================

const GAME = { title: "World Cup Bowl", number: 177, category: "Football", pool: 4.0 };

// The app's real prize-split bracket for an 8-winner field (generousMedium),
// valued against the pool so the graphic shows believable USDT amounts.
const SHARES = [0.28, 0.19, 0.14, 0.1, 0.08, 0.07, 0.07, 0.07];

const NAMES = ["SwiftFalcon42", "GoldenOwl17", "CleverFox88", "LuckyMaple31", "MightyAce54", "RoyalPanda09", "SneakyTiger73", "BraveWhiz26"];

type Winner = { rank: number; name: string; score: number; prize: number; pfp: string };

const WINNERS: Winner[] = SHARES.map((share, i) => ({
  rank: i + 1,
  name: NAMES[i],
  score: 2480 - i * 170 - (i % 2) * 40,
  prize: Math.round(GAME.pool * share * 100) / 100,
  pfp: `https://i.pravatar.cc/120?u=${NAMES[i]}`,
}));

const usdt = (n: number) => `${n.toFixed(2)} USDT`;

// Per-place theming (gold / silver / bronze).
const PLACE = {
  1: { color: "#FFC931", glow: "rgba(255,201,49,0.55)", medal: "🥇", height: 168, ring: "#FFD86B", label: "CHAMPION" },
  2: { color: "#C9D6E5", glow: "rgba(201,214,229,0.4)", medal: "🥈", height: 124, ring: "#E4ECF5", label: "2ND" },
  3: { color: "#E0884E", glow: "rgba(224,136,78,0.4)", medal: "🥉", height: 100, ring: "#F0A877", label: "3RD" },
} as const;

// =============================================================================
// PODIUM COLUMN
// =============================================================================

function PodiumColumn({ winner, delay }: { winner: Winner; delay: number }) {
  const p = PLACE[winner.rank as 1 | 2 | 3];
  const isChamp = winner.rank === 1;

  return (
    <motion.div
      className="flex flex-col items-center justify-end"
      style={{ width: isChamp ? 132 : 104 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
    >
      {/* Crown for the champion */}
      {isChamp && (
        <motion.div
          className="text-3xl mb-0.5"
          initial={{ y: -20, opacity: 0, scale: 0 }}
          animate={{ y: [0, -4, 0], opacity: 1, scale: 1 }}
          transition={{
            y: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
            opacity: { delay: delay + 0.3 },
            scale: { type: "spring", stiffness: 400, damping: 12, delay: delay + 0.3 },
          }}
        >
          👑
        </motion.div>
      )}

      {/* Avatar with glowing ring + medal badge */}
      <motion.div
        className="relative"
        initial={{ scale: 0, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 16, delay: delay + 0.15 }}
      >
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: isChamp ? 80 : 60,
            height: isChamp ? 80 : 60,
            border: `3px solid ${p.ring}`,
            boxShadow: `0 0 24px ${p.glow}`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={winner.pfp} alt={winner.name} className="w-full h-full object-cover" />
        </div>
        <div
          className="absolute -bottom-1.5 -right-1.5 rounded-full flex items-center justify-center"
          style={{ width: isChamp ? 30 : 24, height: isChamp ? 30 : 24, background: "#15151A", border: `2px solid ${p.ring}`, fontSize: isChamp ? 15 : 12 }}
        >
          {p.medal}
        </div>
      </motion.div>

      {/* Name + prize */}
      <motion.div
        className="flex flex-col items-center mt-2.5 px-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.4 }}
      >
        <span className="font-body text-white text-center leading-tight truncate max-w-[120px]" style={{ fontSize: isChamp ? 15 : 13 }}>
          {winner.name}
        </span>
        <span className="font-display text-[10px] text-white/40 tabular-nums">{winner.score.toLocaleString()} pts</span>
        <span
          className="font-body mt-1.5 px-2.5 py-1 rounded-full tabular-nums"
          style={{ fontSize: isChamp ? 15 : 13, color: p.color, background: `${p.color}1a`, border: `1px solid ${p.color}55` }}
        >
          {usdt(winner.prize)}
        </span>
      </motion.div>

      {/* The rising podium block */}
      <motion.div
        className="w-full mt-3 rounded-t-xl relative overflow-hidden"
        style={{
          background: `linear-gradient(180deg, ${p.color}38, ${p.color}10)`,
          border: `1px solid ${p.color}45`,
          borderBottom: "none",
        }}
        initial={{ height: 0 }}
        animate={{ height: p.height }}
        transition={{ type: "spring", stiffness: 120, damping: 18, delay }}
      >
        <div className="absolute inset-0 flex items-start justify-center pt-3">
          <span className="font-body" style={{ fontSize: isChamp ? 40 : 30, color: `${p.color}`, opacity: 0.9 }}>
            {winner.rank}
          </span>
        </div>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${p.ring}, transparent)` }} />
      </motion.div>
    </motion.div>
  );
}

// =============================================================================
// RUNNER-UP ROW
// =============================================================================

function RunnerRow({ winner, delay }: { winner: Winner; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/8"
      style={{ background: "rgba(255,255,255,0.03)" }}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <span className="font-body text-[14px] text-white/45 w-5 text-center tabular-nums">{winner.rank}</span>
      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={winner.pfp} alt="" className="w-full h-full object-cover" />
      </div>
      <span className="font-body text-[14px] text-white flex-1 truncate">{winner.name}</span>
      <span className="font-display text-[10px] text-white/35 tabular-nums">{winner.score.toLocaleString()}</span>
      <span className="font-body text-[13px] text-[#FFC931] tabular-nums">{usdt(winner.prize)}</span>
    </motion.div>
  );
}

// =============================================================================
// CONFETTI
// =============================================================================

function ConfettiOverlay() {
  const colors = ["#FFC931", "#14B985", "#FB72FF", "#00CFF2", "#FF6B6B"];
  // Deterministic per-index pseudo-randomness (pure — no Math.random during
  // render) so the confetti is varied but render stays side-effect free.
  const rand = (seed: number) => {
    const x = Math.sin(seed * 99.13) * 43758.5453;
    return x - Math.floor(x);
  };
  // Base delay ~0.9s so the burst lands with the champion's podium block.
  const pieces = Array.from({ length: 56 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: rand(i + 1) * 100,
    delay: 0.9 + rand(i + 13) * 1.2,
    duration: 2.2 + rand(i + 27) * 2,
    size: 6 + rand(i + 41) * 7,
    rotate: rand(i + 53) > 0.5 ? 720 : -720,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size * 0.6, backgroundColor: p.color, left: `${p.left}%`, top: -12 }}
          initial={{ y: -12, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN
// =============================================================================

export default function WinnersSamplePage() {
  // Bumping the key remounts the whole tree, replaying every animation + confetti.
  const [runKey, setRunKey] = useState(0);

  // Podium order so the centre champion is visually flanked: 2nd · 1st · 3rd.
  const podium = [WINNERS[1], WINNERS[0], WINNERS[2]];
  const runnersUp = WINNERS.slice(3);

  return (
    <div className="app-background min-h-dvh flex flex-col items-center relative overflow-x-hidden overflow-y-auto" key={runKey}>
      {/* Gold spotlight */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[420px]"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,201,49,0.22), transparent 62%)" }}
      />

      <div className="w-full max-w-md mx-auto flex-1 flex flex-col px-4 pt-6 pb-8 relative">
        {/* Header */}
        <motion.header
          className="flex items-center justify-between mb-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.webp" alt="Waffles" className="w-[28px] h-[22px] object-contain" />
            <span className="font-body text-[18px] leading-none tracking-[-0.03em] text-white">WAFFLES</span>
          </div>
          <button onClick={() => setRunKey((k) => k + 1)} className="font-display text-xs text-white/40 hover:text-white transition-colors">
            REPLAY
          </button>
        </motion.header>

        {/* Title */}
        <motion.div className="text-center mb-1" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <div className="font-display text-[11px] tracking-[0.18em] uppercase text-white/45">
            {GAME.title} #{String(GAME.number).padStart(3, "0")} · {GAME.category}
          </div>
          <motion.h1
            className="font-body text-[44px] leading-[0.9] text-[#FFC931] mt-1"
            animate={{ textShadow: ["0 0 0px rgba(255,201,49,0)", "0 0 26px rgba(255,201,49,0.6)", "0 0 0px rgba(255,201,49,0)"] }}
            transition={{ duration: 2.6, repeat: Infinity }}
          >
            WINNERS
          </motion.h1>
        </motion.div>

        {/* Prize pool chip */}
        <motion.div
          className="self-center flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-7"
          style={{ background: "rgba(255,201,49,0.1)", border: "1px solid rgba(255,201,49,0.32)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <span className="text-base">🏆</span>
          <span className="font-body text-[15px] text-white tabular-nums">{usdt(GAME.pool)}</span>
          <span className="font-display text-[11px] text-white/40">· {WINNERS.length} paid · split the pool</span>
        </motion.div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-2.5">
          {/* 2nd (left), 1st (centre), 3rd (right). Reveal order staggers 3rd→2nd→1st. */}
          <PodiumColumn winner={podium[0]} delay={0.55} />
          <PodiumColumn winner={podium[1]} delay={0.85} />
          <PodiumColumn winner={podium[2]} delay={0.4} />
        </div>
        {/* Podium base line */}
        <div className="h-px mx-2" style={{ background: "linear-gradient(90deg, transparent, rgba(255,201,49,0.4), transparent)" }} />

        {/* Runners-up */}
        <motion.div className="mt-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <span className="font-display text-[11px] tracking-wider uppercase text-white/40">Runners-up</span>
            <span className="font-display text-[11px] text-white/30">prize</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {runnersUp.map((w, i) => (
              <RunnerRow key={w.rank} winner={w} delay={1.3 + i * 0.08} />
            ))}
          </div>
        </motion.div>

        {/* Share CTA */}
        <motion.button
          className="mt-7 w-full py-3.5 rounded-2xl font-body text-[17px] text-[#1E1E1E]"
          style={{ background: "linear-gradient(180deg, #FFD86B, #FFC931)", boxShadow: "0 8px 24px rgba(255,201,49,0.3)" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          SHARE THE WINNERS
        </motion.button>
      </div>

      <ConfettiOverlay />
    </div>
  );
}
