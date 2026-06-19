"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play } from "lucide-react";

/**
 * Audio Identification clue. The real game streams `soundUrl`; here a tap plays
 * a short synthesized blip via the Web Audio API and runs an equalizer so the
 * "press play, then identify" interaction feels real without an asset.
 */
export function AudioClue({ line }: { line: string }) {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const stopRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (stopRef.current) window.clearTimeout(stopRef.current);
      void ctxRef.current?.close();
    };
  }, []);

  const toggle = () => {
    if (playing) {
      setPlaying(false);
      if (stopRef.current) window.clearTimeout(stopRef.current);
      return;
    }
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = ctxRef.current ?? new AC();
      ctxRef.current = ctx;
      const now = ctx.currentTime;
      // A rising two-note "goal!" sting.
      [
        [330, 0],
        [494, 0.18],
        [659, 0.36],
      ].forEach(([freq, at]) => {
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
      setPlaying(true);
      stopRef.current = window.setTimeout(() => setPlaying(false), 1100);
    } catch {
      // Audio unavailable — the equalizer + caption still convey the format.
      setPlaying(true);
      stopRef.current = window.setTimeout(() => setPlaying(false), 1100);
    }
  };

  return (
    <motion.figure
      className="mx-auto mb-4 w-full px-4"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <div className="mx-auto flex w-full max-w-[320px] items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3 shadow-[0_8px_0_#000]">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause clip" : "Play clip"}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-waffle-gold text-[#1e1e1e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e1e1e]"
        >
          {playing ? <Pause size={20} fill="#1e1e1e" /> : <Play size={20} fill="#1e1e1e" />}
        </button>
        <div className="flex flex-1 items-end gap-[3px] h-9">
          {Array.from({ length: 22 }).map((_, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-full bg-waffle-gold/70"
              animate={
                playing
                  ? { scaleY: [0.25, 0.4 + ((i * 7) % 9) / 10, 0.3, 1, 0.4] }
                  : { scaleY: 0.18 }
              }
              transition={
                playing
                  ? { duration: 0.5 + (i % 5) * 0.08, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
              style={{ originY: 1, height: "100%" }}
            />
          ))}
        </div>
      </div>
      <figcaption className="mx-auto mt-2 max-w-[320px] text-center font-display text-[12px] italic leading-snug text-white/55">
        {line}
      </figcaption>
    </motion.figure>
  );
}
