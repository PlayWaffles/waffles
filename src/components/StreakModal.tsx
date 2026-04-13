"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import { useUser } from "@/hooks/useUser";
import { useProfileStats } from "@/hooks/useProfileStats";
import { springs } from "@/lib/animations";

const STREAK_SEEN_KEY = "waffles:streak_seen_date";

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function alreadySeenToday() {
  try {
    return localStorage.getItem(STREAK_SEEN_KEY) === getTodayDateString();
  } catch {
    return true;
  }
}

export function StreakModal() {
  const [shouldFetch, setShouldFetch] = useState(false);

  // Check localStorage before triggering any API calls
  useEffect(() => {
    if (!alreadySeenToday()) setShouldFetch(true);
  }, []);

  if (!shouldFetch) return null;
  return <StreakModalInner />;
}

function StreakModalInner() {
  const { user } = useUser();
  const { stats, isLoading } = useProfileStats();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoading || !user || !stats) return;

    if (alreadySeenToday()) return;

    if (stats.currentStreak > 0) {
      localStorage.setItem(STREAK_SEEN_KEY, getTodayDateString());
      setIsVisible(true);
    }
  }, [isLoading, user, stats]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Escape key to close
  useEffect(() => {
    if (!isVisible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isVisible, dismiss]);

  // Auto-focus dismiss button
  const dismissRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => dismissRef.current?.focus(), 400);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  const streak = stats?.currentStreak ?? 0;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          onClick={dismiss}
          role="dialog"
          aria-modal="true"
          aria-labelledby="streak-modal-title"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />

          {/* Modal card — matches ProfileCard style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={springs.bouncy}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[361px] overflow-hidden"
            style={{
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              background:
                "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 201, 49, 0.12) 100%)",
            }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.03)_50%,transparent_75%)]" />

            <div className="relative z-10 flex flex-col items-center px-5 pt-6 pb-5 gap-3">
              {/* Streak label */}
              <motion.h2
                id="streak-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="font-display text-white text-center"
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  lineHeight: "130%",
                  letterSpacing: "-0.03em",
                }}
              >
                Streak
              </motion.h2>

              {/* Flame + Number row — same layout as ProfileCard */}
              <div className="flex flex-row justify-center items-center gap-2.5">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, ...springs.bouncy }}
                  className="w-8 h-14 flex items-center justify-center"
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.1, 1],
                      filter: [
                        "brightness(1)",
                        "brightness(1.2)",
                        "brightness(1)",
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Image
                      src="/images/icons/streak-flame.svg"
                      width={32}
                      height={56}
                      fetchPriority="high"
                      alt="Streak Flame"
                      className="object-contain"
                    />
                  </motion.div>
                </motion.div>

                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 10,
                    delay: 0.3,
                  }}
                  className="font-body text-white"
                  style={{
                    fontSize: "clamp(40px, 12vw, 56px)",
                    lineHeight: "90%",
                    fontWeight: 400,
                  }}
                >
                  {streak}
                </motion.span>
              </div>

              {/* Streak message */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
                className="font-display text-center text-muted"
                style={{
                  fontSize: "13px",
                  lineHeight: "150%",
                  letterSpacing: "-0.03em",
                  maxWidth: "260px",
                }}
              >
                {streak === 1
                  ? "You started a streak! Come back tomorrow to keep it going."
                  : streak < 5
                    ? "Keep the momentum going. Play daily to grow your streak!"
                    : streak < 10
                      ? "You're on fire! Don't break the chain."
                      : "Unstoppable. You're a Waffles legend."}
              </motion.p>

              {/* Streak dots */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, ...springs.gentle }}
                className="flex items-center gap-1.5 mt-1"
              >
                {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 0.55 + i * 0.06,
                      type: "spring",
                      stiffness: 500,
                      damping: 15,
                    }}
                    className="h-2 w-2 rounded-full bg-waffle-gold"
                    style={{
                      opacity: 0.35 + (i / Math.min(streak, 7)) * 0.65,
                    }}
                  />
                ))}
                {streak > 7 && (
                  <span className="font-display text-[11px] text-muted ml-0.5">
                    +{streak - 7}
                  </span>
                )}
              </motion.div>

              {/* Dismiss button — gold pill matching WaffleButton style */}
              <motion.button
                ref={dismissRef}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, ...springs.gentle }}
                whileTap={{ scale: 0.95 }}
                onClick={dismiss}
                className="w-full mt-2 pixel-corners bg-waffle-gold py-3 font-body text-[16px] text-[#1E1E1E] leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              >
                LET&apos;S GO
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
