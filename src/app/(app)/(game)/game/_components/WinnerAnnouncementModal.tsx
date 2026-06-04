"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRightIcon,
  TrophyIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import type { LastGameResult, LastGameWinner } from "@/lib/game";
import { springs } from "@/lib/animations";
import { getPlayerAvatarUrl } from "@/lib/avatar";
import { formatGameLabel } from "@/lib/game/labels";

interface WinnerAnnouncementModalProps {
  result: LastGameResult;
  onClose: () => void;
}

function formatPrize(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function displayName(winner: LastGameWinner) {
  return winner.username ?? "Player";
}

function WinnerAvatar({
  winner,
  size,
}: {
  winner: LastGameWinner;
  size: number;
}) {
  const name = displayName(winner);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10"
      style={{ width: size, height: size }}
    >
      <Image
        unoptimized
        src={getPlayerAvatarUrl({
          pfpUrl: winner.pfpUrl,
          username: winner.username,
        })}
        alt={`${name} avatar`}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}

export function WinnerAnnouncementModal({
  result,
  onClose,
}: WinnerAnnouncementModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [winner, ...otherWinners] = result.winners;
  const gameLabel = formatGameLabel(result.gameNumber);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const closeButton = modalRef.current?.querySelector<HTMLElement>(
        'button[aria-label="Close winner announcement"]',
      );
      closeButton?.focus();
    }, 200);

    return () => window.clearTimeout(timer);
  }, []);

  if (!winner) return null;

  return (
    <motion.div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-announcement-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 overflow-y-auto backdrop-blur-xl"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(255,201,49,0.08) 0%, rgba(9,9,10,0.98) 58%)",
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, ...springs.snappy }}
          className="mb-3 flex justify-end"
        >
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-waffle-gold"
            aria-label="Close winner announcement"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </motion.div>

        <motion.header
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...springs.gentle }}
          className="space-y-3"
        >
          <span className="inline-flex rounded-full border border-waffle-gold/15 bg-waffle-gold/10 px-3 py-1 font-display text-[11px] uppercase tracking-[0.25em] text-waffle-gold">
            Winner Announcement
          </span>
          <div className="space-y-1">
            <h2
              id="winner-announcement-title"
              className="font-body text-[34px] leading-[0.95] text-white"
            >
              {gameLabel}
              <br />
              <span className="text-waffle-gold">WINNERS</span>
            </h2>
            <p className="font-display text-[14px] leading-[1.5] text-white/45">
              ${formatPrize(result.prizeAwarded)} paid out in the last game.
            </p>
          </div>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.16, ...springs.gentle }}
          className="mt-7 overflow-hidden rounded-2xl border border-waffle-gold/20 bg-waffle-gold/[0.04]"
        >
          <div className="relative p-5">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(255,201,49,0.16) 0%, transparent 68%)",
              }}
            />
            <div className="relative flex items-center gap-4">
              <WinnerAvatar winner={winner} size={72} />
              <div className="min-w-0 flex-1">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-waffle-gold/10 px-2.5 py-1 text-waffle-gold">
                  <TrophyIcon className="h-4 w-4" />
                  <span className="font-body text-[12px] leading-none">
                    Rank #{winner.rank}
                  </span>
                </div>
                <p className="truncate font-body text-[24px] leading-none text-white">
                  {displayName(winner)}
                </p>
                <p className="mt-2 font-display text-[18px] leading-none text-waffle-gold">
                  won ${formatPrize(winner.prize)}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {otherWinners.length > 0 && (
          <div className="mt-4 space-y-2">
            {otherWinners.map((entry, index) => (
              <motion.div
                key={`${entry.rank}-${entry.username ?? index}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.24 + index * 0.07,
                  ...springs.gentle,
                }}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/8 font-body text-[13px] text-white/70">
                  {entry.rank}
                </div>
                <WinnerAvatar winner={entry} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[15px] leading-none text-white">
                    {displayName(entry)}
                  </p>
                  <p className="mt-1 font-display text-[12px] leading-none text-white/35">
                    {entry.score.toLocaleString()} pts
                  </p>
                </div>
                <span className="shrink-0 font-display text-[14px] text-waffle-gold">
                  ${formatPrize(entry.prize)}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {result.totalWinners > result.winners.length && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.46 }}
            className="mt-3 text-center font-display text-[12px] text-white/30"
          >
            {result.totalWinners - result.winners.length} more winner
            {result.totalWinners - result.winners.length === 1 ? "" : "s"} on
            the full leaderboard.
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.52, ...springs.gentle }}
          className="mt-auto pt-7"
        >
          <Link
            href={`/leaderboard?gameId=${result.gameId}`}
            onClick={onClose}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-waffle-gold px-4 font-body text-[15px] text-black transition-transform active:scale-[0.98]"
          >
            View leaderboard
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
