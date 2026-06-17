"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { BINGO } from "../data";
import { Prompt, TimerBar, useCountdown } from "./parts";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6], // diagonals
];

export function Bingo({ onExit }: { onExit: () => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const { remaining } = useCountdown(BINGO.durationSec, !submitted);
  const finished = submitted || remaining <= 0;

  const toggle = (i: number) => {
    if (finished) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const bingoLine = finished
    ? LINES.find((line) => line.every((i) => BINGO.cells[i].truth && selected.has(i)))
    : undefined;
  const hits = [...selected].filter((i) => BINGO.cells[i].truth).length;
  const mistakes = [...selected].filter((i) => !BINGO.cells[i].truth).length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Prompt kicker="TRIVIA BINGO" text={BINGO.prompt} />
      <div className="mb-5">
        <TimerBar remaining={remaining} duration={BINGO.durationSec} />
      </div>

      <div className="mx-auto grid w-full max-w-[360px] grid-cols-3 gap-2 px-4">
        {BINGO.cells.map((cell, i) => {
          const isSel = selected.has(i);
          const inBingo = bingoLine?.includes(i);
          const rightPick = finished && isSel && cell.truth;
          const wrongPick = finished && isSel && !cell.truth;
          const missed = finished && !isSel && cell.truth;
          return (
            <motion.button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={finished}
              whileTap={{ scale: 0.94 }}
              className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-2 text-center font-display text-[11px] leading-tight"
              animate={{
                borderColor: inBingo
                  ? "#FFC931"
                  : rightPick
                    ? "#14B985"
                    : wrongPick
                      ? "#FF4444"
                      : missed
                        ? "#FF444455"
                        : isSel
                          ? "#FFC931"
                          : "rgba(255,255,255,0.12)",
                backgroundColor: inBingo
                  ? "rgba(255,201,49,0.22)"
                  : rightPick
                    ? "rgba(20,185,133,0.18)"
                    : wrongPick
                      ? "rgba(255,68,68,0.16)"
                      : isSel
                        ? "rgba(255,201,49,0.12)"
                        : "#141414",
              }}
            >
              <span className={isSel || rightPick || missed ? "text-white" : "text-white/65"}>
                {cell.text}
              </span>
              {finished ? (
                <span className="mt-1 text-[13px]">{cell.truth ? "✓" : "✗"}</span>
              ) : null}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 px-5">
        {finished ? (
          <>
            <p className="font-body text-[20px]" style={{ color: bingoLine ? "#FFC931" : "#fff" }}>
              {bingoLine ? "BINGO! 🎉" : `${hits} true · ${mistakes} wrong`}
            </p>
            <PixelButton variant="outline" colorTheme="cyan" width={240} height={48} fontSize={14} onClick={onExit}>
              BACK TO FORMATS
            </PixelButton>
          </>
        ) : (
          <PixelButton
            variant="filled"
            colorTheme="gold"
            width={240}
            height={52}
            fontSize={15}
            onClick={() => setSubmitted(true)}
          >
            CALL BINGO
          </PixelButton>
        )}
      </div>
    </div>
  );
}
