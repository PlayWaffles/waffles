"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CircularProgress from "./CircularProgress";
import { LiveEventFeed } from "../../../_components/LiveEventFeed";
import { GameChat } from "../../../_components/chat/GameChat";
import Image from "next/image";
import {
  authenticatedFetch,
  getAppRuntime,
  isMiniPayRuntime,
  type AppRuntime,
} from "@/lib/client/runtime";
import { getDisplayName } from "@/lib/address";

const MAX_LEADERBOARD_ENTRIES = 8;

// ==========================================
// TYPES
// ==========================================

interface BreakViewProps {
  seconds: number;
  nextRoundNumber: number;
  isLastRound?: boolean;
  totalDuration?: number;
  gameId: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  fid: number | null;
  wallet?: string | null;
  username: string | null;
  pfpUrl: string | null;
  score: number;
}

// ==========================================
// COMPONENT
// ==========================================

export default function BreakView({
  seconds,
  isLastRound = false,
  totalDuration = 20,
  gameId,
}: BreakViewProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [runtime, setRuntime] = useState<AppRuntime>(
    isMiniPayRuntime() ? "minipay" : "browser",
  );
  const isMiniPay = runtime === "minipay";

  const percentage = Math.max(
    0,
    Math.min(100, (seconds / totalDuration) * 100)
  );

  // Low time state for micro-interactions
  const isLowTime = seconds <= 3;

  useEffect(() => {
    let cancelled = false;

    getAppRuntime()
      .then((nextRuntime) => {
        if (!cancelled) setRuntime(nextRuntime);
      })
      .catch(() => {
        if (!cancelled) setRuntime(isMiniPayRuntime() ? "minipay" : "browser");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch leaderboard when break view mounts
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await authenticatedFetch(
          `/api/v1/games/${gameId}/leaderboard?limit=${MAX_LEADERBOARD_ENTRIES}`
        );
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || ([] as LeaderboardEntry[]));
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard:", e as Error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [gameId]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center w-full max-w-lg mx-auto px-3 sm:px-4 pt-4 gap-2 sm:gap-3 font-body">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <span className="text-white/80 text-base sm:text-[18px] font-medium uppercase tracking-tight">
              please wait
            </span>
          </motion.div>

          {/* Title + Timer Row */}
          <div className="relative flex items-center justify-between w-full my-4">
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="text-white text-[36px] leading-[0.92] tracking-tight uppercase"
            >
              {isLastRound ? "Last round in" : "Next round in"}
            </motion.h1>

            {/* Circular Timer with micro-interactions */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2, type: "spring", stiffness: 200 }}
              className="absolute right-0 top-1/2 -translate-y-1/2"
            >
              <div className="relative flex items-center justify-center w-12 h-12 sm:w-[60px] sm:h-[60px] md:w-[70px] md:h-[70px]">
                <CircularProgress
                  size={60}
                  strokeWidth={4}
                  color={isLowTime ? "#FF6B6B" : "#1B8FF5"}
                  percentage={percentage}
                />

                {/* Animated number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    <motion.span
                      key={seconds}
                      initial={{ scale: 1.3, opacity: 0, y: -8 }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{ scale: 0.7, opacity: 0, y: 8 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="text-lg sm:text-[22px] md:text-[24px] font-bold"
                      style={{ color: isLowTime ? "#FF6B6B" : "#1B8FF5" }}
                    >
                      {seconds}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Pulse ring when low time */}
                {isLowTime && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-500/40"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                )}
              </div>
            </motion.div>
          </div>

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col items-start p-2 sm:p-3 gap-1.5 sm:gap-2 w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl"
          >
            {loading ? (
              <div className="text-white/60 text-center w-full py-2 text-sm sm:text-base">
                Loading...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-white/60 text-center w-full py-2 text-sm sm:text-base">
                No players yet
              </div>
            ) : (
              leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.userId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                  className="flex items-center gap-1.5 sm:gap-2 w-full py-0.5 sm:py-1"
                >
                  {/* Rank Badge */}
                  <div className="flex justify-center items-center w-6 h-6 sm:w-7 sm:h-7 bg-white/10 rounded-full shrink-0">
                    <span className="text-[12px] sm:text-[14px] text-white font-medium">
                      {entry.rank}
                    </span>
                  </div>

                  {/* Avatar */}
                  {entry.pfpUrl ? (
                    <Image
                      width={20}
                      height={20}
                      unoptimized
                      src={entry.pfpUrl}
                      alt={entry.username || "User"}
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#F0F3F4] overflow-hidden shrink-0" />
                  )}

                  {/* Username */}
                  <span className="text-base sm:text-lg md:text-[20px] text-white truncate flex-1">
                    {getDisplayName({ username: entry.username, wallet: entry.wallet })}
                  </span>

                  {/* Score */}
                  <span className="text-sm sm:text-base text-white/60 shrink-0 font-medium">
                    {entry.score.toLocaleString()}
                  </span>
                </motion.div>
              ))
            )}
          </motion.div>
        </div>
      </div>

      {/* Bottom section - always at bottom */}
      {!isMiniPay && (
        <div className="shrink-0 mt-auto">
          <div className="w-full max-w-lg mx-auto px-3 sm:px-4">
            <LiveEventFeed />
          </div>

          <div className="w-full bg-[#0E0E0E] border-t border-white/10 px-3 sm:px-4 py-2 sm:py-3">
            <div className="w-full max-w-lg mx-auto">
              <GameChat />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
