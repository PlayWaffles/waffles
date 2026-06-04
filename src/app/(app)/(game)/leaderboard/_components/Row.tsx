"use client";

import { LeaderboardEntry } from "@/lib/types";
import { UsdcIcon, FlashIcon } from "@/components/icons";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getDisplayName } from "@/lib/address";
import { getPlayerAvatarUrl } from "@/lib/avatar";

interface RowProps {
  entry: LeaderboardEntry;
  isCurrentUser?: boolean;
  showScore?: boolean;
}

export function Row({ entry, isCurrentUser = false, showScore = false }: RowProps) {
  const hasScore = showScore && entry.score != null;
  const displayName = getDisplayName({
    username: entry.username,
    wallet: entry.wallet,
  });
  const formattedPrize = entry.prize.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <motion.li
      layout
      whileHover={{
        scale: 1.01,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        transition: { duration: 0.1 }
      }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "bg-white/5 border border-white/10 flex h-12 items-center justify-between rounded-xl px-3",
        "transition-all duration-150 ease-out",
        isCurrentUser &&
        "bg-blue-900/30 ring-1 ring-blue-500/60"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-full bg-white/10 shrink-0">
          <span className="text-xs leading-tight">{entry.rank}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <motion.div
            className="relative h-7 w-7 rounded-full bg-white/10 shrink-0"
            whileHover={{ scale: 1.2 }}
          >
            <Image
              unoptimized
              src={getPlayerAvatarUrl({
                pfpUrl: entry.pfpUrl,
                username: entry.username ?? displayName,
              })}
              alt={displayName}
              width={28}
              height={28}
              className="rounded-full bg-[#F0F3F4] object-cover"
              draggable={false}
            />
          </motion.div>
          <div className="text-sm leading-tight truncate">{displayName}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {hasScore && (
          <div className="flex items-center gap-1">
            <FlashIcon className="h-4 w-4" />
            <span className="font-display font-medium text-sm tracking-tight text-white/70">
              {entry.score!.toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <UsdcIcon className="h-4 w-4" />
          <span className="font-display font-medium text-base tracking-tight">
            {formattedPrize}
          </span>
        </div>
      </div>
    </motion.li>
  );
}
