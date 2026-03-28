"use client";

import { TrophyIcon, UsdcIcon, FlashIcon } from "@/components/icons";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { LeaderboardEntry } from "@/lib/types";
import { motion } from "framer-motion";

interface Top3Props {
  entries: LeaderboardEntry[];
  currentUserId?: string | null;
  showScore?: boolean;
}

const cardStyles = [
  {
    bg: "bg-gradient-to-r from-transparent via-yellow-500/5 to-yellow-500/15",
    border: "border-yellow-400/30",
    trophy: "#FFC931",
  },
  {
    bg: "bg-gradient-to-r from-transparent via-cyan-500/5 to-cyan-500/15",
    border: "border-cyan-400/30",
    trophy: "#19ABD3",
  },
  {
    bg: "bg-gradient-to-r from-transparent via-orange-500/5 to-orange-500/15",
    border: "border-orange-400/30",
    trophy: "#D34D19",
  },
];

export function Top3({ entries, currentUserId, showScore = false }: Top3Props) {
  const topEntries = entries?.slice(0, 3) ?? [];

  if (topEntries.length === 0) return null;

  return (
    <div
      className="
        flex w-full
        gap-(--gap)
      "
      style={
        {
          "--gap": "clamp(0.25rem, 2.2vw, 1rem)",
          "--pad": "clamp(0.5rem, 2.2vw, 1rem)",
          "--radius": "clamp(0.75rem, 2vw, 1rem)",
        } as React.CSSProperties
      }
    >
      {topEntries.map((entry, i) => {
        const isCurrentUser =
          currentUserId != null && entry.userId === currentUserId;
        const styles = cardStyles[i] ?? cardStyles[cardStyles.length - 1];

        const hasScore = showScore && entry.score != null;
        const formattedPrize = entry.prize.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        return (
          <motion.article
            key={entry.rank ?? i}
            initial={{ opacity: 0, scale: 0.8, y: 30, rotate: i === 0 ? 0 : i === 1 ? -2 : 2 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: 0.2 + i * 0.1
            }}
            whileHover={{
              scale: 1.05,
              y: -8,
              transition: { type: "spring", stiffness: 400, damping: 10 }
            }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "basis-1/3 min-w-0 flex-1 relative overflow-hidden group",
              "rounded-(--radius) border",
              "p-(--pad) bg-clip-padding",
              "flex flex-col gap-[calc(var(--pad)*0.8)]",
              "transition-all duration-200 ease-out",
              "hover:z-20", // Elevate z-index on hover to prevent overlap
              styles.bg,
              styles.border,
              isCurrentUser &&
              "ring-2 ring-offset-2 ring-offset-black ring-blue-400"
            )}
          >
            {/* Shine effect on hover */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-size-[250%_250%] animate-shimmer" />

            <motion.div
              initial={{ rotate: -10 }}
              animate={{ rotate: 0 }}
              transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
            >
              <TrophyIcon
                color={styles.trophy}
                className="shrink-0 relative z-10"
                style={{
                  width: "clamp(14px, 2.8vw, 20px)",
                  height: "clamp(14px, 2.8vw, 20px)",
                }}
                aria-label={`Place ${i + 1}`}
              />
            </motion.div>

            <div className="flex min-w-0 items-center gap-[calc(var(--pad)*0.5)] relative z-10">
              <motion.div
                className="relative rounded-full bg-white/10 overflow-hidden shrink-0"
                style={{
                  width: "clamp(18px, 3vw, 24px)",
                  height: "clamp(18px, 3vw, 24px)",
                }}
                whileHover={{ scale: 1.2 }}
              >
                {entry.pfpUrl ? (
                  <Image
                    unoptimized
                    src={entry.pfpUrl}
                    alt={entry.username || "Unknown User"}
                    width={28}
                    height={28}
                    className="rounded-full bg-[#F0F3F4] object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[calc(var(--pad)*0.6)] font-bold text-white/70">
                    {entry.username?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </motion.div>
              <span
                title={entry.username || "Unknown User"}
                className="
                  min-w-0 truncate text-white font-body font-normal leading-tight
                "
                style={{ fontSize: "clamp(0.7rem, 2.3vw, 0.95rem)" }}
              >
                {entry.username}
              </span>
            </div>

            <div className="mt-auto flex flex-col gap-[calc(var(--pad)*0.3)] relative z-10">
              {hasScore && (
                <div className="flex items-center gap-[calc(var(--pad)*0.4)]">
                  <FlashIcon
                    className="shrink-0"
                    style={{
                      width: "clamp(12px, 2.4vw, 16px)",
                      height: "clamp(12px, 2.4vw, 16px)",
                    }}
                  />
                  <span
                    className="font-display font-medium tracking-tight leading-[1.1] text-white/70"
                    style={{ fontSize: "clamp(0.7rem, 2.2vw, 0.85rem)" }}
                  >
                    {entry.score!.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-[calc(var(--pad)*0.4)]">
                <UsdcIcon
                  className="shrink-0"
                  style={{
                    width: "clamp(14px, 2.8vw, 20px)",
                    height: "clamp(14px, 2.8vw, 20px)",
                  }}
                />
                <span
                  className="font-display font-medium tracking-tight leading-[1.1]"
                  style={{ fontSize: "clamp(0.85rem, 2.6vw, 1rem)" }}
                >
                  {formattedPrize}
                </span>
              </div>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
