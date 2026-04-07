"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { UploadIcon } from "@/components/icons";

interface ProfileCardProps {
  username: string;
  streak: number;
  avatarUrl: string;
  onUpload?: () => void;
}

export function ProfileCard({
  username,
  streak,
  avatarUrl,
  onUpload,
}: ProfileCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for premium feel
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className="relative box-border flex flex-col items-center p-3 gap-3 w-full h-[152px] overflow-hidden group"
      style={{
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        background:
          "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 201, 49, 0.12) 100%)",
      }}
    >
      {/* Background PFP Effect - Ghost Image (Centered) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center z-0 opacity-[0.07] pointer-events-none grayscale contrast-150"
        whileHover={{ scale: 1.1, opacity: 0.1 }}
        transition={{ duration: 0.8 }}
      >
        <Image
          width={200}
          height={200}
          src={avatarUrl}
          alt=""
          className="w-[200px] h-[200px] object-cover rounded-full blur-xs"
        />
      </motion.div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 z-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%)] bg-size-[250%_250%] animate-shimmer" />

      {/* User + Time Row */}
      <div className="relative z-10 flex flex-row justify-between items-start py-1 gap-1.5 w-full flex-1">
        {/* User Section */}
        <div className="flex flex-row justify-between items-start gap-2 w-full flex-1">
          {/* Upload Button (Left) */}
          <motion.div
            onClick={onUpload}
            whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.2)" }}
            whileTap={{ scale: 0.9 }}
            className="box-border flex flex-row justify-center items-center p-2 gap-2 w-[34px] h-[34px] bg-white/13 rounded-[900px] cursor-pointer transition-colors"
            role="button"
            aria-label="Upload"
          >
            <UploadIcon className="text-white w-[18px] h-[18px]" />
          </motion.div>

          {/* Center Content: Avatar, Username, Streak */}
          <div className="flex flex-col justify-center items-center gap-[13px] h-[120px]">
            {/* Avatar + Username Row */}
            <div className="flex flex-row justify-center items-center gap-2">
              {/* Avatar Circle */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/20"
                style={{ background: "#FFF7B8" }}
              >
                <Image
                  width={36}
                  height={36}
                  src={avatarUrl}
                  alt={`${username} avatar`}
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {/* Username */}
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="font-body text-white uppercase"
                style={{
                  fontSize: "18px",
                  lineHeight: "130%",
                  fontWeight: 400,
                }}
              >
                {username}
              </motion.span>
            </div>

            {/* Streak Section */}
            <div className="flex flex-col justify-center items-center flex-1">
              {/* Streak Label */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="font-display text-white text-center"
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  lineHeight: "130%",
                  letterSpacing: "-0.03em",
                }}
              >
                Streak
              </motion.span>

              {/* Streak Value Row */}
              <div className="flex flex-col justify-center items-center gap-1">
                <div className="flex flex-row justify-center items-center gap-2.5">
                  {/* Fire Icon */}
                  <motion.div
                    className="w-5 h-9 flex items-center justify-center"
                    animate={{
                      scale: [1, 1.1, 1],
                      filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Image
                      src="/images/icons/streak-flame.svg"
                      width={20}
                      height={36}
                      fetchPriority="high"
                      alt="Streak Flame"
                      className="object-contain"
                    />
                  </motion.div>

                  {/* Number */}
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 10,
                      delay: 0.5
                    }}
                    className="font-body text-white"
                    style={{
                      fontSize: "34px",
                      lineHeight: "90%",
                      fontWeight: 400,
                    }}
                  >
                    {streak}
                  </motion.span>
                </div>
              </div>
            </div>
          </div>

          {/* Invisible placeholder (Right) for symmetry */}
          <div
            className="box-border flex flex-row justify-center items-center p-2 gap-2 w-[34px] h-[34px] bg-white/13 opacity-0 rounded-[900px]"
            aria-hidden="true"
          >
            <UploadIcon className="text-white w-[18px] h-[18px]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
