"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { TIMED_LIST } from "../data";
import { Prompt, TimerBar, useCountdown } from "./parts";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function TimedList({ onExit }: { onExit: () => void }) {
  const [found, setFound] = useState<string[]>([]);
  const [entry, setEntry] = useState("");
  const [shake, setShake] = useState(0);

  const complete = found.length === TIMED_LIST.answers.length;
  const { remaining } = useCountdown(TIMED_LIST.durationSec, !complete);
  const done = complete || remaining <= 0;

  const lookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of TIMED_LIST.answers) for (const al of a.aliases) m.set(al, a.label);
    return m;
  }, []);

  const submit = () => {
    if (done) return;
    const label = lookup.get(norm(entry));
    if (label && !found.includes(label)) {
      setFound((f) => [...f, label]);
    } else if (entry.trim()) {
      setShake((s) => s + 1);
    }
    setEntry("");
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
      <Prompt kicker={`TIMED LIST · ${found.length}/${TIMED_LIST.answers.length}`} text={TIMED_LIST.prompt} />
      <div className="mb-4">
        <TimerBar remaining={remaining} duration={TIMED_LIST.durationSec} />
      </div>

      <div className="px-5">
        <motion.form
          key={shake}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          animate={shake ? { x: [0, -8, 8, -4, 0] } : {}}
          transition={{ duration: 0.3 }}
          className="flex gap-2"
        >
          <input
            autoFocus
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            disabled={done}
            placeholder={done ? "Time!" : "Type a country…"}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 font-body text-[16px] text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold)] disabled:opacity-50"
          />
          <PixelButton variant="filled" colorTheme="green" width={92} height={48} fontSize={14} disabled={done} type="submit">
            ADD
          </PixelButton>
        </motion.form>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 px-5">
        {TIMED_LIST.answers.map((a) => {
          const got = found.includes(a.label);
          const missed = done && !got;
          return (
            <motion.div
              key={a.label}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 font-display text-[13px]"
              animate={{
                borderColor: got ? "#14B985" : missed ? "#FF444455" : "rgba(255,255,255,0.12)",
                backgroundColor: got ? "#14B98520" : "#141414",
              }}
            >
              <span className={got ? "text-success" : missed ? "text-danger-soft" : "text-white/40"}>
                {got ? "✓" : missed ? "✗" : "•"}
              </span>
              <span className={got || missed ? "text-white" : "text-white/25"}>
                {got || missed ? a.label : "• • •"}
              </span>
            </motion.div>
          );
        })}
      </div>

      {done ? (
        <div className="mt-7 flex flex-col items-center gap-2 px-5">
          <p className="font-body text-[20px] text-white">
            {found.length} / {TIMED_LIST.answers.length} found
          </p>
          <p className="mb-2 font-display text-[12px] uppercase tracking-wider text-white/45">
            {complete ? "Clean sweep! 🏆" : "Beat the clock next time"}
          </p>
          <PixelButton variant="outline" colorTheme="cyan" width={240} height={48} fontSize={14} onClick={onExit}>
            BACK TO FORMATS
          </PixelButton>
        </div>
      ) : null}
    </div>
  );
}
