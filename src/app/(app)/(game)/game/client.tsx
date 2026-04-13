"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import posthog from "posthog-js";
import {
  QuestionMarkCircleIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

import { springs, staggerContainer, fadeInUp } from "@/lib/animations";
import type { GameWithQuestionCount, LastGameResult } from "@/lib/game";
import { usePendingPurchaseRecovery } from "@/hooks/usePendingPurchaseRecovery";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useUser } from "@/hooks/useUser";

import Image from "next/image";
import { GameChat } from "./_components/chat/GameChat";
import { LiveEventFeed } from "./_components/LiveEventFeed";
import { NextGameCard } from "./_components/NextGameCard";
import { CheerOverlay } from "./_components/CheerOverlay";
import { HowToPlayModal, HOW_TO_PLAY_STEPS } from "./_components/HowToPlayModal";


// ==========================================
// TYPES
// ==========================================

const MODAL_HOW_TO_PLAY = "how-to-play";

interface GameHubProps {
  /** Game data from server component - not stored in React state */
  game: GameWithQuestionCount | null;
  /** Top 3 winners from the last ended game — social proof */
  lastGameResult: LastGameResult | null;
}

// ==========================================
// COMPONENT
// ==========================================

export function GameHub({ game, lastGameResult }: GameHubProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // User context for recovery
  const { address } = useAccount();
  const { user } = useUser();
  const { refetchEntry } = useRealtime();

  const isHowToPlayOpen = searchParams.get("modal") === MODAL_HOW_TO_PLAY;

  // Shared URL param helpers (computed once, used by both branches)
  const howToPlayHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("modal", MODAL_HOW_TO_PLAY);
    return `${pathname}?${params.toString()}`;
  })();

  const closeHowToPlay = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("modal");
    const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(url, { scroll: false });
  };

  // Track game lobby view
  const hasTrackedView = useRef<string | null>(null);
  useEffect(() => {
    if (game && hasTrackedView.current !== game.id) {
      hasTrackedView.current = game.id;
      posthog.capture("game_viewed", {
        game_id: game.id,
        game_number: game.gameNumber,
        theme: game.theme,
        prize_pool: game.prizePool,
        player_count: game.playerCount,
      });
    }
  }, [game]);

  // Recovery: Check for pending purchases that failed to sync
  usePendingPurchaseRecovery(
    game?.id ?? "",
    user?.id,
    address,
    refetchEntry, // Callback when recovered
  );


  // ==========================================
  // RENDER: Empty State
  // ==========================================

  if (!game) {
    return (
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="relative flex-1 overflow-y-auto px-4 py-2"
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-5 py-12">
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center space-y-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, ...springs.bouncy }}
              className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-4 py-1.5"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFC931]/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFC931]" />
              </span>
              <span className="font-display text-[11px] uppercase tracking-[0.2em] text-white/50">
                No active games
              </span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ...springs.bouncy }}
              className="text-white font-body text-[28px] leading-[1.15] tracking-[0.08em]"
            >
              THE ARENA
              <br />
              <span className="text-[#FFC931]">AWAITS</span>
            </motion.h2>
          </motion.div>

          {/* How to Play Card */}
          <motion.div variants={fadeInUp} className="w-full">
            <Link
              href={howToPlayHref}
              scroll={false}
              className="group relative block w-full overflow-hidden rounded-2xl border border-white/8"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,201,49,0.06) 0%, rgba(21,21,25,0.6) 50%, rgba(255,201,49,0.03) 100%)",
              }}
            >
              {/* Shimmer edge */}
              <div
                className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,201,49,0.12) 0%, transparent 40%, transparent 60%, rgba(255,201,49,0.08) 100%)",
                }}
              />
              <div className="relative flex items-center justify-between gap-4 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFC931]/10 border border-[#FFC931]/15">
                    <QuestionMarkCircleIcon className="w-6 h-6 text-[#FFC931]" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-body text-xl text-white leading-none">
                      How to Play
                    </h3>
                    <p className="font-display text-[13px] text-white/40 leading-snug">
                      Arena format, scoring &amp; payouts
                    </p>
                  </div>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/8 transition-all duration-300 group-hover:bg-[#FFC931]/15 group-hover:border-[#FFC931]/20">
                  <ChevronRightIcon className="w-4 h-4 text-white/50 transition-all duration-300 group-hover:text-[#FFC931] group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Quick preview steps — collapsed */}
          <motion.div variants={fadeInUp} className="w-full space-y-2">
            {HOW_TO_PLAY_STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + index * 0.1, ...springs.gentle }}
                className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3"
              >
                <span className="font-body text-[13px] text-[#FFC931]/70 tabular-nums leading-none">
                  {step.number}
                </span>
                <span className="h-3 w-px bg-white/10" />
                <span className="font-display text-[13px] text-white/60 leading-none">
                  {step.title}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {isHowToPlayOpen && (
          <HowToPlayModal onClose={closeHowToPlay} position="absolute" />
        )}
      </motion.section>
    );
  }

  // ==========================================
  // RENDER: Active Game
  // ==========================================

  return (
    <>
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="shrink flex flex-col justify-start items-center overflow-hidden px-4 pt-4"
      >
        <NextGameCard game={game} />

        {/* Last game winners — social proof */}
        {lastGameResult && lastGameResult.winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, ...springs.gentle }}
            className="mt-3 w-full md:max-w-[361px]"
          >
            <Link
              href={`/leaderboard?gameId=${lastGameResult.gameId}`}
              className="group flex items-center justify-between w-full px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:bg-white/[0.05]"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Winner avatars — overlapping */}
                <div className="flex items-center shrink-0">
                  {lastGameResult.winners.map((w, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-[1.5px] border-white/60 overflow-hidden bg-card shrink-0"
                      style={{ marginLeft: i > 0 ? "-6px" : "0", zIndex: 3 - i }}
                    >
                      {w.pfpUrl ? (
                        <Image
                          src={w.pfpUrl}
                          alt={w.username ?? "Winner"}
                          width={28}
                          height={28}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-linear-to-br from-waffle-gold-warm to-[#FF6B35]" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Copy */}
                <div className="flex flex-col min-w-0">
                  <span className="font-body text-[14px] text-white leading-tight truncate">
                    {lastGameResult.winners[0].username ?? "Player"} + {lastGameResult.totalWinners - 1} others
                  </span>
                  <span className="font-display text-[12px] text-waffle-gold leading-tight">
                    won ${lastGameResult.prizePool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <ChevronRightIcon className="w-4 h-4 text-white/25 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-waffle-gold/50" />
            </Link>
          </motion.div>
        )}

        {/* How to Play link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3"
        >
          <Link
            href={howToPlayHref}
            scroll={false}
            className="group inline-flex items-center gap-1.5 font-display text-[13px] text-white/35 transition-colors hover:text-[#FFC931]/70"
          >
            <QuestionMarkCircleIcon className="w-3.5 h-3.5" />
            How to play
            <ChevronRightIcon className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>
      </motion.section>

      {/* Live Event Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, ...springs.gentle }}
        className="flex-1 flex flex-col justify-end w-full px-4"
        style={{ minHeight: "clamp(60px, 12vh, 180px)" }}
      >
        <LiveEventFeed />
      </motion.div>

      {/* Game Chat */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, ...springs.gentle }}
        className="shrink-0 w-full bg-[#0E0E0E] border-t border-white/10 px-4 py-3"
      >
        <div className="w-full max-w-lg mx-auto">
          <GameChat />
        </div>
      </motion.div>

      {isHowToPlayOpen && (
        <HowToPlayModal onClose={closeHowToPlay} showStepIcons={false} />
      )}

      <CheerOverlay />
    </>
  );
}
