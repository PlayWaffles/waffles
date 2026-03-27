"use client";

/**
 * WaitingScreen
 *
 * Displayed when a player has answered all questions but the game
 * is still live. Shows a countdown until the game ends, the player's
 * current score, leaderboard standings, and chat.
 */

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTimer } from "@/hooks/useTimer";
import { GameChat } from "../../../_components/chat/GameChat";
import { LiveEventFeed } from "../../../_components/LiveEventFeed";
import { authenticatedFetch } from "@/lib/client/runtime";
import { getDisplayName } from "@/lib/address";
import { FlashIcon, ArrowLeftIcon } from "@/components/icons";

// ==========================================
// CONSTANTS
// ==========================================

const MAX_LEADERBOARD = 8;

// Subtle floating animation keyframes for relaxed vibe
const floatVariants = {
  animate: {
    y: [0, -6, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

// ==========================================
// TYPES
// ==========================================

interface WaitingScreenProps {
  score: number;
  gameEndsAt: Date;
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
  isCurrentUser?: boolean;
}

// ==========================================
// COMPONENT
// ==========================================

export default function WaitingScreen({
  score,
  gameEndsAt,
  gameId,
}: WaitingScreenProps) {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<number | null>(null);

  // Countdown timer until game ends
  const secondsRemaining = useTimer(gameEndsAt.getTime());

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `/api/v1/games/${gameId}/leaderboard?limit=${MAX_LEADERBOARD}`
      );
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.currentUserRank || null);
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchLeaderboard();

    // Refresh leaderboard every 10 seconds
    const interval = setInterval(fetchLeaderboard, 10_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col items-center w-full max-w-md mx-auto px-4 pt-4 pb-4 gap-5">
          {/* ==================== Back Button ==================== */}
          <motion.button
            onClick={() => router.push("/game")}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="self-start flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-transform"
            aria-label="Go back to game hub"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="font-display text-[13px] text-white/70">Back</span>
          </motion.button>

          {/* ==================== Header Section ==================== */}
          <motion.div
            className="flex flex-col items-center gap-3 w-full"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {/* Animated hourglass/waiting icon */}
            <motion.div
              variants={floatVariants}
              animate="animate"
              className="relative"
            >
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  duration: 0.6,
                  ease: [0.34, 1.56, 0.64, 1],
                  delay: 0.1,
                }}
              >
                <Image
                  src="/images/illustrations/waffles.svg"
                  alt="Waiting"
                  width={120}
                  height={80}
                  className="opacity-80"
                />
              </motion.div>

              {/* Subtle glow effect */}
              <div className="absolute inset-0 bg-[#F5BB1B]/10 blur-3xl rounded-full -z-10" />
            </motion.div>

            {/* Status text */}
            <motion.p
              className="font-display text-[14px] font-medium text-[#99A0AE] tracking-tight uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              All done! Waiting for others...
            </motion.p>
          </motion.div>

          {/* ==================== Timer Card ==================== */}
          <motion.div
            className="relative w-full rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Gradient border */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                padding: "1px",
                background:
                  "linear-gradient(135deg, rgba(0, 207, 242, 0.2) 0%, rgba(27, 143, 245, 0.4) 100%)",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />

            <div className="relative bg-linear-to-b from-white/5 to-[#1B8FF5]/10 p-4 rounded-2xl">
              <p className="font-display text-[12px] font-medium text-[#99A0AE] text-center mb-2 uppercase tracking-wider">
                Game ends in
              </p>

              <AnimatePresence mode="popLayout">
                <motion.div
                  key={secondsRemaining}
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-center items-center"
                >
                  <span
                    className="font-body text-[52px] leading-none tracking-tight"
                    style={{
                      background:
                        "linear-gradient(180deg, #FFFFFF 0%, #00CFF2 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {formatTime(secondsRemaining)}
                  </span>
                </motion.div>
              </AnimatePresence>

              {/* Pulsing indicator when time is low */}
              {secondsRemaining <= 30 && (
                <motion.div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF6B6B]"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>
          </motion.div>

          {/* ==================== Score Card ==================== */}
          <motion.div
            className="relative w-full rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {/* Gradient border */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                padding: "1px",
                background:
                  "linear-gradient(135deg, rgba(20, 185, 133, 0.15) 0%, rgba(20, 185, 133, 0.35) 100%)",
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />

            <div className="relative bg-linear-to-b from-white/5 to-[#14B985]/10 p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-display text-[12px] font-medium text-[#99A0AE] uppercase tracking-wider mb-1">
                    Your Score
                  </span>
                  <div className="flex items-center gap-1.5">
                    <FlashIcon className="w-6 h-6" />
                    <motion.span
                      className="font-body text-[36px] leading-none text-white"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {score.toLocaleString()}
                    </motion.span>
                  </div>
                </div>

                {/* Rank badge */}
                {userRank && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 15,
                      delay: 0.5,
                    }}
                    className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-[#14B985]/20 border border-[#14B985]/40"
                  >
                    <span className="font-display text-[10px] text-[#14B985] uppercase">
                      Rank
                    </span>
                    <span className="font-body text-[20px] text-[#14B985] leading-none">
                      #{userRank}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ==================== Leaderboard ==================== */}
          <motion.div
            className="w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-[14px] font-medium text-white/80 uppercase tracking-wider">
                Current Standings
              </h3>
              {/* <motion.div
                className="w-2 h-2 rounded-full bg-[#14B985]"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              /> */}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <motion.div
                    className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </div>
              ) : leaderboard.length === 0 ? (
                <p className="text-white/50 text-center py-4 font-display text-sm">
                  No players yet
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {leaderboard.map((entry, index) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                      className={`flex items-center gap-2.5 py-1.5 px-2 rounded-lg transition-colors ${entry.isCurrentUser
                        ? "bg-[#14B985]/15 border border-[#14B985]/30"
                        : "hover:bg-white/5"
                        }`}
                    >
                      {/* Rank */}
                      <div
                        className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${entry.rank === 1
                          ? "bg-[#F5BB1B]/20 text-[#F5BB1B]"
                          : entry.rank === 2
                            ? "bg-[#C0C0C0]/20 text-[#C0C0C0]"
                            : entry.rank === 3
                              ? "bg-[#CD7F32]/20 text-[#CD7F32]"
                              : "bg-white/10 text-white/60"
                          }`}
                      >
                        <span className="font-display text-[11px] font-bold">
                          {entry.rank}
                        </span>
                      </div>

                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-[#F0F3F4]">
                        {entry.pfpUrl ? (
                          <Image
                            src={entry.pfpUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-linear-to-br from-[#F5BB1B] to-[#FF6B35]" />
                        )}
                      </div>

                      {/* Username */}
                      <span
                        className={`font-display text-[14px] truncate flex-1 ${entry.isCurrentUser ? "text-[#14B985]" : "text-white"
                          }`}
                      >
                        {getDisplayName({ username: entry.username, wallet: entry.wallet })}
                        {entry.isCurrentUser && (
                          <span className="ml-1 text-[10px] text-[#14B985]/70">
                            (you)
                          </span>
                        )}
                      </span>

                      {/* Score */}
                      <span className="font-display text-[13px] text-white/60 shrink-0">
                        {entry.score.toLocaleString()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ==================== Bottom Section ==================== */}
      <div className="shrink-0 mt-auto">
        {/* Live Feed */}
        <div className="w-full max-w-md mx-auto px-4">
          <LiveEventFeed />
        </div>

        {/* Chat */}
        <div className="w-full bg-[#0E0E0E] border-t border-white/10 px-4 py-3">
          <div className="w-full max-w-md mx-auto">
            <GameChat />
          </div>
        </div>
      </div>
    </div>
  );
}
