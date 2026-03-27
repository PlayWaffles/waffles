"use client";

import { motion } from "framer-motion";
import {
  CheckCircleIcon,
  VideoCameraIcon,
  FlagIcon,
  StarIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { springs } from "@/lib/animations";

const HOW_TO_PLAY_STEPS = [
  {
    number: "01",
    title: "Secure your spot",
    description:
      "The arena opens every Monday, Wednesday, and Friday. Grab a ticket before the next game starts.",
    icon: <CheckCircleIcon className="w-5 h-5" />,
  },
  {
    number: "02",
    title: "Identify the remix",
    description:
      "Each arena runs 3 rounds with 3 questions per round. We show you AI-remixed movie scenes, and you answer before the timer ends.",
    icon: <VideoCameraIcon className="w-5 h-5" />,
  },
  {
    number: "03",
    title: "Race the leaderboard",
    description:
      "Speed plus accuracy earns points. When the 60-minute arena closes, the Top 10 split the prize pool.",
    icon: <FlagIcon className="w-5 h-5" />,
  },
];

interface HowToPlayModalProps {
  onClose: () => void;
  /** "absolute" for empty state overlay, "fixed" for active game overlay */
  position?: "absolute" | "fixed";
  /** Whether to show step icons (empty state) or step numbers (active game) */
  showStepIcons?: boolean;
}

export { HOW_TO_PLAY_STEPS };

export function HowToPlayModal({
  onClose,
  position = "fixed",
  showStepIcons = true,
}: HowToPlayModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`${position} inset-0 z-${position === "fixed" ? 50 : 20} overflow-y-auto backdrop-blur-xl`}
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(255,201,49,0.04) 0%, rgba(9,9,10,0.98) 60%)",
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-5">
        {/* Close button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, ...springs.snappy }}
          className="flex justify-end mb-2"
        >
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close how to play"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </motion.div>

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...springs.gentle }}
          className="mb-8 space-y-3"
        >
          <span className="inline-flex rounded-full bg-[#FFC931]/10 border border-[#FFC931]/15 px-3 py-1 text-[11px] font-display uppercase tracking-[0.25em] text-[#FFC931]">
            How to Play
          </span>
          <h3 className="font-body text-[32px] leading-[0.95] tracking-[-0.02em] text-white">
            GUESS THE
            <br />
            <span className="text-[#FFC931]">MOVIE SCENE</span>
          </h3>
          <p className="font-display text-[14px] leading-[1.5] text-white/45 max-w-[320px]">
            Compete in a live 60-minute arena where every second counts. Speed,
            accuracy, and nerves of steel win the pot.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-3">
          {HOW_TO_PLAY_STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.15 + index * 0.1,
                ...springs.gentle,
              }}
              className="relative overflow-hidden rounded-2xl border border-white/[0.06]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
              }}
            >
              {/* Accent bar left */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[2px]"
                style={{
                  background: `linear-gradient(180deg, rgba(255,201,49,${0.5 - index * 0.12}) 0%, transparent 100%)`,
                }}
              />

              <div className="relative flex items-start gap-4 p-4 pl-5">
                {/* Number + icon */}
                <div className="flex flex-col items-center gap-1.5 pt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFC931]/8 border border-[#FFC931]/12 text-[#FFC931]">
                    {showStepIcons ? (
                      step.icon
                    ) : (
                      <span className="font-body text-[14px]">
                        {step.number}
                      </span>
                    )}
                  </div>
                  {showStepIcons && (
                    <span className="font-body text-[11px] text-[#FFC931]/40 tabular-nums">
                      {step.number}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1 pt-0.5">
                  <p className="font-body text-[16px] leading-none text-white">
                    {step.title}
                  </p>
                  <p className="font-display text-[13px] leading-[1.5] text-white/40">
                    {step.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Prize pool callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ...springs.gentle }}
          className="relative mt-4 overflow-hidden rounded-2xl border border-[#FFC931]/12"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,201,49,0.06) 0%, rgba(255,201,49,0.02) 100%)",
          }}
        >
          {/* Decorative corner glow */}
          <div
            className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,201,49,0.12) 0%, transparent 70%)",
            }}
          />
          <div className="relative p-4">
            <div className="flex items-center gap-2 mb-2">
              <StarIcon className="w-4 h-4 text-[#FFC931]" />
              <span className="font-body text-[14px] text-[#FFC931] leading-none">
                PRIZE POOL
              </span>
            </div>
            <p className="font-display text-[13px] leading-[1.5] text-white/50">
              When the clock stops, the Top 10 split the pot based on points
              earned. More speed, more accuracy, bigger share.
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-auto pt-8 pb-2 text-center font-display text-[12px] tracking-wide text-white/25"
        >
          Guess movie scenes. Win cash. Simple.
        </motion.p>
      </div>
    </motion.div>
  );
}
