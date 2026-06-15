"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatTimeColon } from "@/lib/utils";
import { TimerTube } from "./TimerTube";

interface QuestionCardHeaderProps {
  questionNumber: number;
  totalQuestions: number;
  remaining: number;
  duration: number;
  streak?: number;
  streakBroken?: boolean;
}

function StreakFire({ streak }: { streak: number }) {
  if (streak < 2) return null;

  return (
    <motion.div
      className="flex items-center gap-1"
      initial={{ scale: 0, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 12 }}
      key={streak}
    >
      <motion.span
        className="text-lg"
        animate={{ scale: [1, 1.3, 1], rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        🔥
      </motion.span>
      <motion.span
        className="font-body text-[18px]"
        style={{
          color:
            streak >= 5
              ? "#FF4444"
              : streak >= 3
                ? "#FFC931"
                : "#FF8844",
          textShadow: `0 0 ${streak * 4}px ${streak >= 5 ? "#FF444480" : streak >= 3 ? "#FFC93180" : "#FF884480"}`,
        }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        x{streak}
      </motion.span>
    </motion.div>
  );
}

function StreakBreak({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <motion.div
      className="flex items-center gap-1"
      initial={{ scale: 1, opacity: 1 }}
      animate={{ scale: 0.3, opacity: 0, y: 30, rotate: 25 }}
      transition={{ duration: 0.5, ease: "easeIn" }}
    >
      <span className="text-lg">🔥</span>
      <span className="font-body text-[18px] text-danger-soft">x0</span>
    </motion.div>
  );
}

export function QuestionCardHeader({
  questionNumber,
  totalQuestions,
  remaining,
  duration,
  streak = 0,
  streakBroken = false,
}: QuestionCardHeaderProps) {
  const isLowTime = remaining <= 3 && remaining > 0;
  const isTimeUp = remaining === 0;

  // Announce time at key intervals for screen readers (every 5s, plus final 3s)
  const timerAnnouncement = useMemo(() => {
    if (isTimeUp) return "Time is up";
    if (remaining <= 3) return `${remaining} seconds left`;
    if (remaining % 5 === 0) return `${remaining} seconds remaining`;
    return "";
  }, [remaining, isTimeUp]);

  return (
    <motion.div
      className="w-full flex items-center justify-between px-3 py-2"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Left side: question counter + streak */}
      <div className="flex items-center gap-2">
        <motion.span
          className="font-body text-white text-[18px] leading-none tracking-tight"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              key={questionNumber}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="inline-block"
            >
              {String(questionNumber).padStart(2, "0")}
            </motion.span>
          </AnimatePresence>
          /{String(totalQuestions).padStart(2, "0")}
        </motion.span>

        <AnimatePresence mode="wait">
          {streakBroken ? (
            <StreakBreak key="break" show />
          ) : (
            <StreakFire key="fire" streak={streak} />
          )}
        </AnimatePresence>
      </div>

      {/* Screen reader timer announcements */}
      <span className="sr-only" aria-live="assertive" aria-atomic="true">
        {timerAnnouncement}
      </span>

      {/* Right side: timer */}
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        aria-hidden="true"
      >
        {/* Animated timer text */}
        <motion.div
          className="relative overflow-hidden"
          animate={
            isLowTime
              ? {
                scale: [1, 1.1, 1],
              }
              : {}
          }
          transition={
            isLowTime ? { duration: 0.5, repeat: Infinity } : undefined
          }
        >
          <AnimatePresence mode="popLayout">
            <motion.span
              key={remaining}
              className="font-body text-[18px] inline-block"
              style={{
                color: isTimeUp || isLowTime ? "var(--danger-soft)" : "#ffffff",
              }}
              initial={{ opacity: 0, y: -12, scale: 1.2 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.8 }}
              transition={{
                duration: 0.25,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              {formatTimeColon(remaining)}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Timer tube with warning state */}
        <motion.div
          animate={isLowTime ? { scale: [1, 1.05, 1] } : {}}
          transition={isLowTime ? { duration: 0.4, repeat: Infinity } : undefined}
        >
          <TimerTube remaining={remaining} duration={duration} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
