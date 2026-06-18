"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import type { VMedia } from "../data";

/** Format accent → v2 brand colour. */
export const ACCENT: Record<string, string> = {
  gold: "#FFC931",
  purple: "#FB72FF",
  cyan: "#00CFF2",
  green: "#7BE57E",
};

// ---------------------------------------------------------------------------
// Timers
// ---------------------------------------------------------------------------

/** Tenth-of-a-second countdown (matches the v2 question screen feel). */
export function useTenthCountdown(duration: number, active: boolean) {
  const [t, setT] = useState(duration);
  useEffect(() => {
    if (!active || t <= 0) return;
    const id = setTimeout(() => setT((v) => Math.max(0, Math.round((v - 0.1) * 10) / 10)), 100);
    return () => clearTimeout(id);
  }, [active, t]);
  return [t, setT] as const;
}

/** Whole-second countdown for the expansion formats. */
export function useSecondCountdown(duration: number, active: boolean) {
  const [t, setT] = useState(duration);
  useEffect(() => {
    if (!active || t <= 0) return;
    const id = setTimeout(() => setT((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [active, t]);
  return [t, setT] as const;
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------

export function BackBar({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      onClick={onExit}
      aria-label="Back to formats"
      className="pressable"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 30,
        width: 40,
        height: 40,
        borderRadius: 99,
        background: "rgba(0,0,0,.55)",
        border: "1px solid rgba(255,255,255,.12)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ProgressDots({ idx, total, answered }: { idx: number; total: number; answered: boolean }) {
  const dots = Array.from({ length: total }, (_, i) => i < idx + (answered ? 1 : 0));
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 4px" }}>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", display: "flex", border: "1px solid rgba(255,255,255,.05)" }}>
        {dots.map((on, i) => (
          <div key={i} style={{ flex: 1, margin: "0 1px", background: on ? "#FFC931" : "transparent", borderRadius: 99, transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#fff", fontWeight: 800, fontSize: 13 }}>
        <span style={{ opacity: 0.5 }}>Q</span>
        {idx + 1}/{total}
      </div>
    </div>
  );
}

export function TimerRing({ timeLeft, total }: { timeLeft: number; total: number }) {
  const ringDash = 264;
  const pct = Math.max(0, Math.min(1, timeLeft / total));
  const offset = ringDash * (1 - pct);
  const low = timeLeft < 3;
  return (
    <div style={{ width: 96, height: 96, position: "relative", margin: "0 auto" }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none" />
        <circle cx="48" cy="48" r="42" stroke={low ? "#FC1919" : "#FFC931"} strokeWidth="8" fill="none" strokeDasharray={ringDash} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition: "stroke-dashoffset .1s linear, stroke .3s" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: low ? "#FC1919" : "#fff", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{Math.max(0, timeLeft).toFixed(1)}</div>
        <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: 0.5 }}>SECONDS</div>
      </div>
    </div>
  );
}

export function LinearTimer({ remaining, duration }: { remaining: number; duration: number }) {
  const pct = Math.max(0, Math.min(1, remaining / duration));
  const low = remaining <= 5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
      <div style={{ flex: 1, height: 10, borderRadius: 99, background: "rgba(255,255,255,.1)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, borderRadius: 99, background: low ? "#FC1919" : "#FFC931", transition: "width 1s linear" }} />
      </div>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: low ? "#FC1919" : "#fff", fontVariantNumeric: "tabular-nums" }}>{Math.max(0, remaining)}s</span>
    </div>
  );
}

/** Kicker label above a prompt (e.g. "MISSING WORD"). */
export function Kicker({ children, color = "#FFC931" }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color, textAlign: "center" }}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Media clues
// ---------------------------------------------------------------------------

const mediaBox: CSSProperties = {
  width: "100%",
  maxWidth: 280,
  margin: "0 auto",
  aspectRatio: "16 / 9",
  borderRadius: 14,
  overflow: "hidden",
  background: "#0e0e0e",
  border: "5px solid var(--frame)",
  borderTop: 0,
  borderLeft: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export function Illustration({ media }: { media: VMedia }) {
  if (media.kind === "audio") return <AudioClue line={media.line} />;
  return (
    <figure style={{ margin: "0 auto", width: "100%" }}>
      <div style={mediaBox}>{media.kind === "jersey" ? <JerseyArt /> : <TrophyArt />}</div>
    </figure>
  );
}

function JerseyArt() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: "100%" }} aria-label="Football kit">
      <defs>
        <clipPath id="wc-shirt">
          <path d="M70 24 L86 16 Q100 26 114 16 L130 24 L150 40 L138 56 L126 48 L126 104 L74 104 L74 48 L62 56 L50 40 Z" />
        </clipPath>
      </defs>
      <rect width="200" height="120" fill="#0e0e0e" />
      <g clipPath="url(#wc-shirt)">
        <rect x="40" y="10" width="120" height="100" fill="#ffffff" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={52 + i * 24} y="10" width="12" height="100" fill="#74ACDF" />
        ))}
      </g>
      <path d="M70 24 L86 16 Q100 26 114 16 L130 24 L150 40 L138 56 L126 48 L126 104 L74 104 L74 48 L62 56 L50 40 Z" fill="none" stroke="#1e1e1e" strokeWidth="3" strokeLinejoin="round" />
      <text x="100" y="86" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1e1e1e">10</text>
    </svg>
  );
}

function TrophyArt() {
  return (
    <svg viewBox="0 0 200 120" style={{ width: "100%", height: "100%" }} aria-label="Trophy">
      <rect width="200" height="120" fill="#0e0e0e" />
      <defs>
        <linearGradient id="wc-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE08A" />
          <stop offset="0.5" stopColor="#F5BB1B" />
          <stop offset="1" stopColor="#C9881A" />
        </linearGradient>
      </defs>
      <g fill="url(#wc-gold)" stroke="#8a5e12" strokeWidth="2">
        <path d="M74 24 h52 v10 q0 26 -26 30 q-26 -4 -26 -30 Z" />
        <path d="M74 28 q-18 0 -18 -12 h12 q0 6 6 8 Z" />
        <path d="M126 28 q18 0 18 -12 h-12 q0 6 -6 8 Z" />
        <rect x="94" y="62" width="12" height="18" />
        <path d="M82 80 h36 l4 12 h-44 Z" />
        <rect x="72" y="92" width="56" height="10" rx="2" />
      </g>
      <ellipse cx="100" cy="40" rx="9" ry="11" fill="#fff" opacity="0.18" />
    </svg>
  );
}

export function AudioClue({ line }: { line: string }) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (stopRef.current) window.clearTimeout(stopRef.current);
    void ctxRef.current?.close();
  }, []);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      if (stopRef.current) window.clearTimeout(stopRef.current);
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = ctxRef.current ?? new AC();
      ctxRef.current = ctx;
      const now = ctx.currentTime;
      [[330, 0], [494, 0.18], [659, 0.36]].forEach(([freq, at]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.18, now + at + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + at);
        osc.stop(now + at + 0.5);
      });
    } catch {
      /* audio unavailable — the equalizer still conveys the format */
    }
    setPlaying(true);
    stopRef.current = window.setTimeout(() => setPlaying(false), 1100);
  };

  return (
    <figure style={{ margin: "0 auto", width: "100%", maxWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 14, background: "#0e0e0e", border: "5px solid var(--frame)", borderTop: 0, borderLeft: 0, padding: "12px 14px" }}>
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause clip" : "Play clip"}
          className="pressable"
          style={{ width: 44, height: 44, borderRadius: 99, background: "var(--maple-500)", color: "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          {playing ? <Pause size={20} fill="#1e1e1e" /> : <Play size={20} fill="#1e1e1e" />}
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: 34 }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: "100%",
                borderRadius: 2,
                background: "rgba(255,201,49,.7)",
                transformOrigin: "bottom",
                transform: playing ? undefined : "scaleY(0.18)",
                animation: playing ? `wc-eq ${0.5 + (i % 5) * 0.09}s ease-in-out ${i * 0.03}s infinite` : "none",
              }}
            />
          ))}
        </div>
      </div>
      <figcaption style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontStyle: "italic", lineHeight: 1.35, color: "rgba(255,255,255,.55)" }}>{line}</figcaption>
    </figure>
  );
}
