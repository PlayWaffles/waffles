"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import posthog from "posthog-js";
import { notify } from "@/components/ui/Toaster";
import { playSound } from "@/lib/sounds";
import { leaveGame } from "@/actions/game";

interface LeaveGameDrawerProps {
  open: boolean;
  setIsLeaveGameDrawerOpen: Dispatch<SetStateAction<boolean>>;
  gameId: string;
}

// Animation variants for staggered content
const contentVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

const iconVariants = {
  hidden: { opacity: 0, scale: 0.5, rotate: -15 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.5,
      type: "spring" as const,
      stiffness: 300,
      damping: 20,
    },
  },
};

export default function LeaveGameDrawer({
  open,
  setIsLeaveGameDrawerOpen,
  gameId,
}: LeaveGameDrawerProps) {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);
  const prevOpen = useRef(false);

  // Play warning sound when drawer opens
  useEffect(() => {
    if (open && !prevOpen.current) {
      playSound("exitWarning");
    }
    prevOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsLeaveGameDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setIsLeaveGameDrawerOpen]);

  const handleLeaveGame = useCallback(async () => {
    if (!gameId) {
      notify.error("Failed to leave game: Missing game info.");
      return;
    }

    setIsLeaving(true);
    try {
      const result = await leaveGame({ gameId });

      if (!result.success) {
        throw new Error(result.error || "Failed to leave game");
      }

      posthog.capture("game_left", { game_id: gameId });
      notify.success("You've left the game");
      setIsLeaveGameDrawerOpen(false);
      router.push("/game");
      router.refresh();
    } catch (error) {
      console.error("Leave game failed:", error);
      notify.error(error instanceof Error ? error.message : "Failed to leave game");
    } finally {
      setIsLeaving(false);
    }
  }, [gameId, setIsLeaveGameDrawerOpen, router]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-game-title"
          className="fixed inset-0 z-100 font-display"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop with blur */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsLeaveGameDrawerOpen(false)}
            aria-hidden="true"
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(8px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.3 }}
          />

          {/* Drawer panel */}
          <motion.div
            className="absolute inset-x-0 bottom-0"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div
              className="w-full rounded-t-2xl overflow-hidden noise bg-linear-to-b from-[#1E1E1E] to-black"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar with subtle animation */}
              <div className="relative w-full border-b border-white/5 bg-[#191919]">
                <div className="mx-auto w-full max-w-[480px] px-4 pt-3 pb-3 relative">
                  <motion.div
                    className="absolute left-1/2 top-2 -translate-x-1/2 h-[5px] w-9 rounded-[2.5px] bg-white/40"
                    initial={{ scaleX: 0.5, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                  />
                  <div className="pt-5 text-center" />
                </div>
              </div>

              {/* Content with staggered animations */}
              <div
                className="px-4"
                style={{
                  maxHeight: "min(75vh, 644px)",
                  overflowY: "auto",
                }}
              >
                <motion.div
                  className="mx-auto w-full max-w-lg pt-8 pb-6 text-center"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {/* Door icon with bounce entrance */}
                  <motion.div className="mb-3 inline-block" variants={iconVariants}>
                    <motion.div
                      animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                    >
                      <Image
                        src="/images/illustrations/leave-door.svg"
                        alt=""
                        width={84}
                        height={90}
                        priority
                      />
                    </motion.div>
                  </motion.div>

                  {/* Title with shake effect */}
                  <motion.h2
                    id="leave-game-title"
                    className="font-body text-white"
                    style={{
                      fontSize: "44px",
                      lineHeight: "0.92",
                      letterSpacing: "-0.03em",
                    }}
                    variants={itemVariants}
                  >
                    RAGE QUIT?
                  </motion.h2>

                  {/* Subtitle */}
                  <motion.div className="mt-2 mb-6" variants={itemVariants}>
                    <p className="font-display font-medium text-[16px] leading-[130%] tracking-[-0.03em] text-[#99A0AE]">
                      Leaving so soon?
                    </p>
                  </motion.div>

                  {/* Stay button with glow and press effects */}
                  <motion.div variants={itemVariants}>
                    <motion.button
                      onClick={() => setIsLeaveGameDrawerOpen(false)}
                      className={cn(
                        "group w-full rounded-xl bg-white px-4 py-[12px] border-0 relative text-center select-none",
                        "border-r-[5px] border-b-[5px] border-[#14B985]"
                      )}
                      whileHover={{
                        scale: 1.02,
                        boxShadow: "0 0 30px rgba(20, 185, 133, 0.4)",
                      }}
                      whileTap={{
                        scale: 0.98,
                        y: 2,
                        borderBottomWidth: "3px",
                      }}
                      transition={{ duration: 0.15 }}
                    >
                      <span
                        className="block font-body text-[#14B985]"
                        style={{
                          fontSize: "26px",
                          lineHeight: "1.15",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        STAY
                      </span>
                    </motion.button>
                  </motion.div>

                  {/* Leave button with subtle effects */}
                  <motion.div className="mt-3" variants={itemVariants}>
                    <motion.button
                      onClick={handleLeaveGame}
                      disabled={isLeaving}
                      className="w-full rounded-xl px-4 py-[12px] text-center"
                      whileHover={{
                        backgroundColor: "rgba(255, 255, 255, 0.08)",
                        scale: 1.02,
                      }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      animate={isLeaving ? { opacity: 0.6 } : { opacity: 1 }}
                    >
                      <motion.span
                        className="font-body text-[#00CFF2] inline-block"
                        style={{
                          fontSize: "18px",
                          lineHeight: "1.15",
                          letterSpacing: "-0.02em",
                        }}
                        animate={
                          isLeaving
                            ? { opacity: [1, 0.5, 1] }
                            : {}
                        }
                        transition={
                          isLeaving
                            ? { duration: 0.8, repeat: Infinity }
                            : undefined
                        }
                      >
                        {isLeaving ? "LEAVING..." : "YES, LEAVE"}
                      </motion.span>
                    </motion.button>
                  </motion.div>
                  <div className="h-4" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
