"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { ORDERING } from "../data";
import { Prompt, TimerBar, useCountdown } from "./parts";

type Item = (typeof ORDERING.items)[number];

const shuffled = (items: Item[]) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Guard against landing on the correct order by chance.
  if (a.every((it, i) => it.id === items[i].id)) a.reverse();
  return a;
};

export function Ordering({ onExit }: { onExit: () => void }) {
  const pool = useMemo(() => shuffled(ORDERING.items), []);
  const correctOrder = useMemo(
    () => [...ORDERING.items].sort((a, b) => a.year - b.year).map((i) => i.id),
    [],
  );
  const [order, setOrder] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { remaining } = useCountdown(ORDERING.durationSec, !submitted);
  const timedOut = remaining <= 0 && !submitted;
  const finished = submitted || timedOut;
  const allPlaced = order.length === pool.length;

  const toggle = (id: string) => {
    if (finished) return;
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };

  const correctCount = order.filter((id, i) => id === correctOrder[i]).length;
  const perfect = finished && order.length === correctOrder.length && correctCount === correctOrder.length;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Prompt kicker="ORDERING" text={ORDERING.prompt} />
      <div className="mb-5">
        <TimerBar remaining={remaining} duration={ORDERING.durationSec} />
      </div>

      <div className="flex flex-col gap-2.5 px-5">
        {pool.map((it) => {
          const pos = order.indexOf(it.id);
          const placed = pos !== -1;
          const correctSlot = finished && placed && correctOrder[pos] === it.id;
          const wrongSlot = finished && placed && correctOrder[pos] !== it.id;
          return (
            <motion.button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              disabled={finished}
              layout
              className="flex items-center gap-3 rounded-xl border-2 px-3 py-3 text-left font-body text-[17px]"
              animate={{
                borderColor: correctSlot
                  ? "#14B985"
                  : wrongSlot
                    ? "#FF4444"
                    : placed
                      ? "#FFC931"
                      : "rgba(255,255,255,0.12)",
                backgroundColor: placed ? "rgba(255,201,49,0.08)" : "#141414",
              }}
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-body text-[15px]"
                style={{
                  background: placed ? "#FFC931" : "rgba(255,255,255,0.08)",
                  color: placed ? "#1e1e1e" : "rgba(255,255,255,0.5)",
                }}
              >
                {placed ? pos + 1 : "?"}
              </span>
              <span className="text-[22px]">{it.flag}</span>
              <span className="flex-1 text-white">{it.label}</span>
              {finished ? <span className="font-display text-[13px] text-white/50">{it.year}</span> : null}
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 px-5">
        {finished ? (
          <>
            <p className="font-body text-[20px]" style={{ color: perfect ? "#14B985" : "#FFC931" }}>
              {perfect ? "Perfect order! 🏆" : `${correctCount}/${correctOrder.length} in place`}
            </p>
            <PixelButton variant="outline" colorTheme="cyan" width={240} height={48} fontSize={14} onClick={onExit}>
              BACK TO FORMATS
            </PixelButton>
          </>
        ) : (
          <PixelButton
            variant="filled"
            colorTheme="purple"
            width={240}
            height={52}
            fontSize={15}
            disabled={!allPlaced}
            onClick={() => setSubmitted(true)}
          >
            {allPlaced ? "CHECK ORDER" : `TAP IN ORDER (${order.length}/${pool.length})`}
          </PixelButton>
        )}
      </div>
    </div>
  );
}
