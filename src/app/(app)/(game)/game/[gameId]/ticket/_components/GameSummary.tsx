"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { formatAddress } from "@/lib/address";

export function GameSummaryCard({
  theme,
  prizePool,
  coverUrl,
}: {
  theme: string;
  prizePool: number;
  coverUrl: string;
}) {
  const { user } = useUser();
  const username = user?.username || formatAddress(user?.wallet);
  const avatarUrl = user?.pfpUrl;

  return (
    <motion.div
      className="relative box-border w-full max-w-[361px] h-[151px] rounded-[16px] mt-8"
      style={{
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 201, 49, 0.12) 100%)",
        border: "1px solid rgba(255, 201, 49, 0.4)",
      }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{
        boxShadow: "0 0 30px rgba(255, 201, 49, 0.2)",
        borderColor: "rgba(255, 201, 49, 0.6)",
      }}
    >
      {/* Shimmer effect overlay */}
      <motion.div
        className="absolute inset-0 rounded-[16px] overflow-hidden pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="absolute top-0 -left-full w-full h-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255, 201, 49, 0.08), transparent)",
          }}
          animate={{ left: ["−100%", "100%"] }}
          transition={{
            duration: 2.5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatDelay: 3,
          }}
        />
      </motion.div>

      {/* ─────────── Top Row: User avatar + name ─────────── */}
      <motion.div
        className="absolute top-4 left-3.5 flex flex-row items-center gap-2.5 max-w-[calc(100%-28px)]"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {/* Avatar */}
        <motion.div
          className="w-[54px] h-[54px] rounded-full overflow-hidden bg-[#D9D9D9] shrink-0"
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="User avatar"
              width={54}
              height={54}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-body text-white text-[23px] leading-[130%]">
                {username?.[0]?.toUpperCase() ?? "•"}
              </span>
            </div>
          )}
        </motion.div>

        {/* Username + subtitle */}
        <div className="flex flex-col justify-center items-start min-w-0">
          <motion.span
            className="font-body text-white truncate max-w-full"
            style={{ fontSize: 23, lineHeight: "130%" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {username?.toUpperCase()}
          </motion.span>
          <motion.span
            className="font-display text-[#99A0AE]"
            style={{
              fontSize: 14,
              lineHeight: "130%",
              letterSpacing: "-0.03em",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            has joined the next game
          </motion.span>
        </div>
      </motion.div>

      {/* ─────────── Bottom Row: Prize Pool + Theme ─────────── */}
      <motion.div
        className="absolute bottom-4 left-3.5 flex flex-row items-center gap-3 flex-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        {/* Prize Pool */}
        <motion.div
          className="flex flex-row items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <motion.div
            animate={{
              y: [0, -2, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 2,
              ease: "easeInOut",
            }}
          >
            <Image
              src="/images/illustrations/money-stack.svg"
              alt="Prize icon"
              width={27}
              height={28}
              className="object-contain shrink-0"
            />
          </motion.div>
          <div className="flex flex-col justify-center items-start">
            <span
              className="font-display text-[#99A0AE]"
              style={{
                fontSize: 11.38,
                lineHeight: "130%",
                letterSpacing: "-0.03em",
              }}
            >
              Prize pool
            </span>
            <span
              className="font-body text-white"
              style={{ fontSize: 17.07, lineHeight: "100%" }}
            >
              ${prizePool.toLocaleString()}
            </span>
          </div>
        </motion.div>

        {/* Theme */}
        <motion.div
          className="flex flex-row items-center justify-center gap-2"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <motion.div
            animate={{
              y: [0, -2, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 2.5,
              ease: "easeInOut",
            }}
          >
            <Image
              src={coverUrl}
              alt="Theme icon"
              width={29}
              height={28}
              className="object-contain shrink-0"
            />
          </motion.div>
          <div className="flex flex-col justify-center items-start">
            <span
              className="font-display text-[#99A0AE]"
              style={{
                fontSize: 11.38,
                lineHeight: "130%",
                letterSpacing: "-0.03em",
              }}
            >
              Theme
            </span>
            <span
              className="font-body text-white"
              style={{ fontSize: 17.07, lineHeight: "100%" }}
            >
              {theme.toUpperCase()}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
