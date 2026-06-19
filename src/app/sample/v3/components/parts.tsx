"use client";

import { useEffect, useState } from "react";

/** Integer-second countdown that stops at 0 (or when `active` goes false). */
export function useCountdown(durationSec: number, active: boolean) {
  const [remaining, setRemaining] = useState(durationSec);

  useEffect(() => {
    if (!active || remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [active, remaining]);

  return { remaining, setRemaining };
}

export function TimerBar({ remaining, duration }: { remaining: number; duration: number }) {
  const pct = Math.max(0, Math.min(1, remaining / duration));
  const low = remaining <= 5;
  return (
    <div className="mx-auto flex w-full max-w-sm items-center gap-3 px-4">
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct * 100}%`, background: low ? "#FF4444" : "var(--brand-gold)" }}
        />
      </div>
      <span
        className="font-body text-[16px] tabular-nums"
        style={{ color: low ? "#FF6B6B" : "#fff" }}
      >
        {remaining}s
      </span>
    </div>
  );
}

export function Prompt({ kicker, text }: { kicker?: string; text: string }) {
  return (
    <div className="px-5 pb-4 pt-2 text-center">
      {kicker ? (
        <p className="mb-2 font-display text-[12px] font-semibold uppercase tracking-[0.15em] text-waffle-gold">
          {kicker}
        </p>
      ) : null}
      <h2
        className="mx-auto max-w-md font-body leading-[1.05] tracking-[-0.02em] text-white"
        style={{ fontSize: "clamp(20px, 5.5vw, 26px)" }}
      >
        {text}
      </h2>
    </div>
  );
}
