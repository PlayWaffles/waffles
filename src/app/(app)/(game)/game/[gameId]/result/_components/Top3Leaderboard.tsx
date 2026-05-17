"use client";

import Image from "next/image";
import clsx from "clsx";
import Link from "next/link";
import { FlashIcon } from "@/components/icons";
import { useState } from "react";
import { motion } from "framer-motion";

// The medal SVGs (using public paths)
const TROPHY_PATHS = [
  "/images/trophies/gold.svg",
  "/images/trophies/silver.svg",
  "/images/trophies/bronze.svg",
];

// Background gradient themes for top 3 positions to match the design
const THEMES = [
  "bg-gradient-to-r from-transparent to-[rgba(52,199,89,0.12)]", // Green for 1st
  "bg-gradient-to-r from-transparent to-[rgba(25,171,211,0.12)]", // Blue for 2nd
  "bg-gradient-to-r from-transparent to-[rgba(211,77,25,0.12)]", // Orange for 3rd
];

// Hover themes for micro-interactions
const HOVER_THEMES = [
  "hover:to-[rgba(52,199,89,0.24)]", // Green for 1st
  "hover:to-[rgba(25,171,211,0.24)]", // Blue for 2nd
  "hover:to-[rgba(211,77,25,0.24)]", // Orange for 3rd
];

interface Entry {
  username: string;
  pfpUrl?: string | null;
  score: number;
}

interface Props {
  entries: Entry[];
  className?: string;
  /** Game ID for the "VIEW LEADERBOARD" link - ensures we show this specific game's leaderboard */
  gameId?: string;
}

export default function Top3Leaderboard({ entries, className, gameId }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Build leaderboard URL - include gameId if provided for game-specific view
  const leaderboardHref = gameId
    ? `/leaderboard?gameId=${gameId}`
    : "/leaderboard";

  return (
    <motion.div
      className={clsx(
        "flex flex-col items-start gap-2 sm:gap-[10px] w-full max-w-[361px] my-2",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9 }}
    >
      {/* Header row */}
      <motion.div
        className="flex flex-row items-center py-[2px] gap-2 w-full flex-wrap sm:flex-nowrap"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 1.0 }}
      >
        <h2 className="font-body text-[18px] sm:text-[22px] leading-[92%] tracking-[-0.03em] text-white whitespace-nowrap">
          TOP 3 FINISHERS
        </h2>
        <div className="flex-1 min-w-0" />
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Link
            href={leaderboardHref}
            className={clsx(
              "flex flex-row justify-center items-center px-2 sm:px-3 py-1.5 sm:py-2 gap-2 rounded-[12px]",
              "transition-all duration-200 ease-out",
              "hover:bg-[#00CFF2]/10 active:scale-95"
            )}
          >
            <span className="font-body text-[14px] sm:text-[18px] leading-[115%] tracking-[-0.02em] text-[#00CFF2] whitespace-nowrap">
              VIEW LEADERBOARD
            </span>
          </Link>
        </motion.div>
      </motion.div>

      {/* Top3Leaderboard entries */}
      {entries.slice(0, 3).map((e, i) => (
        <motion.div
          key={e.username}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
          initial={{ opacity: 0, x: -20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{
            duration: 0.4,
            delay: 1.1 + i * 0.15,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          whileHover={{
            scale: 1.02,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.98 }}
          className={clsx(
            "box-border flex flex-col items-start p-2.5 sm:p-3 gap-2 sm:gap-3 w-full min-h-[52px] sm:min-h-[60px]",
            "border border-white/8 rounded-[12px] sm:rounded-[16px]",
            "transition-all duration-300 ease-out cursor-pointer",
            "hover:border-white/16",
            THEMES[i] || THEMES[2],
            HOVER_THEMES[i] || HOVER_THEMES[2]
          )}
        >
          {/* User + Score row */}
          <div className="flex flex-row justify-between items-center gap-2 sm:gap-[6px] w-full">
            {/* User section */}
            <div className="flex flex-row items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              {/* Trophy */}
              <motion.div
                className="relative w-[24px] h-[30px] sm:w-[29px] sm:h-[36px] shrink-0"
                animate={{
                  scale: hoveredIndex === i ? 1.1 : 1,
                  rotate: hoveredIndex === i ? -5 : 0,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Image
                  src={TROPHY_PATHS[i] || TROPHY_PATHS[2]}
                  fill
                  alt=""
                  className="object-contain drop-shadow-sm"
                  priority
                />
              </motion.div>
              {/* Avatar + Username */}
              <div className="flex flex-row items-center gap-1 min-w-0">
                <motion.div
                  className={clsx(
                    "relative w-4 h-4 sm:w-5 sm:h-5 rounded-full overflow-hidden bg-[#F0F3F4] shrink-0",
                    "ring-2 ring-transparent transition-all duration-200",
                    hoveredIndex === i && "ring-white/20"
                  )}
                  animate={{
                    scale: hoveredIndex === i ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <Image
                    src={e.pfpUrl ?? "/images/avatar-default.webp"}
                    width={20}
                    height={20}
                    alt=""
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                </motion.div>
                <span className="font-body text-[14px] sm:text-[18px] leading-[130%] text-white truncate max-w-[100px] sm:max-w-[150px]">
                  {e.username}
                </span>
              </div>
            </div>

            {/* Score section */}
            <div className="flex flex-col justify-center items-end gap-1 shrink-0">
              <motion.div
                className="flex flex-row items-center gap-0.5 sm:gap-1"
                animate={{
                  scale: hoveredIndex === i ? 1.05 : 1,
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <motion.div
                  animate={
                    hoveredIndex === i
                      ? {
                          scale: [1, 1.2, 1],
                          rotate: [0, 10, -10, 0],
                        }
                      : {}
                  }
                  transition={{
                    duration: 0.6,
                    ease: "easeInOut",
                  }}
                >
                  <FlashIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[#FFC931]" />
                </motion.div>
                <span className="font-body text-[16px] sm:text-[20px] leading-[100%] text-white tabular-nums">
                  {e.score.toLocaleString()}
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
