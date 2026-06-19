"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { MAP_CLICK } from "../data";
import { Prompt, TimerBar, useCountdown } from "./parts";

export function MapClick({ onExit }: { onExit: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked !== null;
  const { remaining } = useCountdown(MAP_CLICK.durationSec, !done);
  const timedOut = remaining <= 0 && !picked;
  const finished = done || timedOut;
  const correct = picked === MAP_CLICK.answerId;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Prompt kicker="MAP CLICK" text={MAP_CLICK.prompt} />
      <div className="mb-5">
        <TimerBar remaining={remaining} duration={MAP_CLICK.durationSec} />
      </div>

      {/* Stylised "atlas" board — tiles laid out on a grid. */}
      <div className="relative mx-4 rounded-2xl border border-border bg-[#0c1a24] p-4 shadow-[0_8px_0_#000]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative grid grid-cols-4 gap-2.5" style={{ gridAutoRows: "1fr" }}>
          {MAP_CLICK.tiles.map((t) => {
            const isAnswer = t.id === MAP_CLICK.answerId;
            const isPicked = t.id === picked;
            const reveal = finished && isAnswer;
            const wrong = isPicked && !correct;
            return (
              <button
                key={t.id}
                type="button"
                disabled={finished}
                onClick={() => !finished && setPicked(t.id)}
                style={{ gridColumn: t.col, gridRow: t.row }}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 font-display text-[11px] leading-tight transition-colors"
              >
                <motion.span
                  className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[10px] border-2 px-1 text-center"
                  animate={{
                    borderColor: reveal ? "#14B985" : wrong ? "#FF4444" : "rgba(255,255,255,0.14)",
                    backgroundColor: reveal ? "#14B98530" : wrong ? "#FF444425" : "rgba(255,255,255,0.05)",
                  }}
                >
                  <span className="text-[22px]">{t.flag}</span>
                  <span className={reveal || wrong ? "text-white" : "text-white/55"}>{t.label}</span>
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 px-5">
        {finished ? (
          <>
            <p className="font-body text-[20px]" style={{ color: correct ? "#14B985" : "#FF6B6B" }}>
              {correct ? "Spot on! 🇶🇦" : timedOut ? "Out of time" : "Not quite"}
            </p>
            <p className="mb-2 font-display text-[12px] uppercase tracking-wider text-white/45">
              Qatar hosted the 2022 World Cup
            </p>
            <PixelButton variant="outline" colorTheme="cyan" width={240} height={48} fontSize={14} onClick={onExit}>
              BACK TO FORMATS
            </PixelButton>
          </>
        ) : (
          <p className="font-display text-[12px] uppercase tracking-wider text-white/35">
            Tap a country
          </p>
        )}
      </div>
    </div>
  );
}
