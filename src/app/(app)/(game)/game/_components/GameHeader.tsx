"use client";
import { LeaveGameIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import LeaveGameDrawer from "./LeaveGameDrawer";
import { usePathname, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { WalletBalance } from "./WalletBalance";
import { motion } from "framer-motion";
import { springs } from "@/lib/animations";
import { useSounds } from "@/components/providers/SoundProvider";
import { MiniPayTestnetToggle } from "./MiniPayTestnetToggle";

export function GameHeader({
  title,
  isCurrentGameLive = false,
  initialShowMiniPayTestnet = false,
}: {
  title?: string | null;
  isCurrentGameLive?: boolean;
  initialShowMiniPayTestnet?: boolean;
}) {
  const pathname = usePathname();
  const params = useParams();
  const { isMuted, toggleMute, playBgMusic, stopBgMusic, isBgPlaying } = useSounds();

  // Extract gameId from route params (cleaner than regex)
  const gameId = params.gameId ? (params.gameId as string) : null;

  const [isLeaveGameDrawerOpen, setIsLeaveGameDrawerOpen] = useState(false);

  // Detect if we are on the /live route
  const isLiveRoute = pathname?.includes("/live");

  // Detect if we're in game-related sections (game, leaderboard, profile)
  const isGameSection = pathname?.startsWith("/game") ||
    pathname?.startsWith("/leaderboard") ||
    pathname?.startsWith("/profile");

  // Start BG music in game sections, stop during live gameplay
  useEffect(() => {
    if (isLiveRoute) {
      stopBgMusic();
    } else if (isGameSection && !isMuted) {
      playBgMusic();
    }
  }, [isGameSection, isLiveRoute, isMuted, playBgMusic, stopBgMusic]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 left-0 shrink-0 z-40 flex items-center justify-between w-full max-w-lg h-[52px] bg-card border-b border-border pt-[12px] px-4 pb-[12px]"
        )}
      >
        {isLiveRoute ? (
          <div className="flex items-center gap-2">
            {/* Logo with hover wiggle */}
            <motion.div
              whileHover={{ rotate: [0, -5, 5, -3, 3, 0] }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeInOut" as const }}
            >
              <Link href={`/game`} className="relative block w-[29.96px] h-[23.24px]">
                <Image
                  src="/logo-small.png"
                  alt="Live game logo"
                  fill
                  sizes="29.96px"
                  priority
                  className="object-contain"
                />
              </Link>
            </motion.div>

            {/* Live indicator with enhanced pulse */}
            <motion.span
              className="flex items-center gap-1.5 mr-auto"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springs.gentle}
            >
              {/* Animated pulsing dot */}
              <motion.span
                className="w-2 h-2 rounded-full bg-live"
                animate={{
                  scale: [1, 1.3, 1],
                  boxShadow: [
                    "0 0 6px rgba(252, 25, 25, 0.8), 0 0 12px rgba(252, 25, 25, 0.4)",
                    "0 0 10px rgba(252, 25, 25, 1), 0 0 20px rgba(252, 25, 25, 0.6)",
                    "0 0 6px rgba(252, 25, 25, 0.8), 0 0 12px rgba(252, 25, 25, 0.4)"
                  ]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut" as const
                }}
              />
              <motion.span
                className="text-live text-[18px] not-italic font-normal leading-[92%] tracking-[-0.03em]"
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" as const }}
              >
                Live
              </motion.span>
            </motion.span>
          </div>
        ) : (
          /* Logo + Title with bounce on hover */
          <motion.div
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
          >
            <Link href="/game" className="flex items-center gap-2">
              <motion.div
                whileHover={{ rotate: [0, -5, 5, -3, 3, 0] }}
                transition={{ duration: 0.4, ease: "easeInOut" as const }}
                className="relative w-[30px] h-[24px]"
              >
                <Image
                  src="/logo-small.png"
                  alt="Waffles logo"
                  fill
                  sizes="30px"
                  priority
                  className="object-contain"
                />
              </motion.div>
              <span className="font-body text-[22px] leading-[92%] tracking-[-0.03em] text-white">
                WAFFLES
              </span>
              {isCurrentGameLive ? (
                <span className="flex items-center gap-1.5">
                  <motion.span
                    className="w-2 h-2 rounded-full bg-live"
                    animate={{
                      scale: [1, 1.3, 1],
                      boxShadow: [
                        "0 0 6px rgba(252, 25, 25, 0.8), 0 0 12px rgba(252, 25, 25, 0.4)",
                        "0 0 10px rgba(252, 25, 25, 1), 0 0 20px rgba(252, 25, 25, 0.6)",
                        "0 0 6px rgba(252, 25, 25, 0.8), 0 0 12px rgba(252, 25, 25, 0.4)",
                      ],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut" as const,
                    }}
                  />
                  <motion.span
                    className="text-live text-[18px] not-italic font-normal leading-[92%] tracking-[-0.03em]"
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut" as const,
                    }}
                  >
                    Live
                  </motion.span>
                </span>
              ) : (
                title && (
                  <span className="font-body text-[18px] leading-[92%] tracking-[-0.03em] text-white/50">
                    {title.replace(/^Waffles\s*/i, "")}
                  </span>
                )
              )}
            </Link>
          </motion.div>
        )}

        <div className="flex items-center gap-2">
          <MuteButton isMuted={isMuted} onToggle={toggleMute} />
          {isLiveRoute ? (
            /* Leave Game button with interactions */
            <motion.button
              onClick={() => setIsLeaveGameDrawerOpen(true)}
              className="flex items-center bg-white/10 rounded-full px-[12px] py-[6px] min-h-[44px] transition-colors font-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
              whileHover={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                scale: 1.05,
                x: 3
              }}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
            >
              {/* Icon with wiggle on hover */}
              <motion.div
                whileHover={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.4 }}
              >
                <LeaveGameIcon className="w-[15px] h-[15px] mr-2" />
              </motion.div>
              <span className="text-[16px] leading-[100%] text-center text-white">
                leave game
              </span>
            </motion.button>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springs.gentle}
              >
                <MiniPayTestnetToggle
                  initialShowTestnet={initialShowMiniPayTestnet}
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springs.gentle}
              >
                <WalletBalance />
              </motion.div>
            </>
          )}
        </div>
      </header>

      <LeaveGameDrawer
        open={isLeaveGameDrawerOpen}
        setIsLeaveGameDrawerOpen={setIsLeaveGameDrawerOpen}
        gameId={gameId!}
      />
    </>
  );
}

function MuteButton({ isMuted, onToggle }: { isMuted: boolean; onToggle: () => void }) {
  return (
    <motion.button
      onClick={onToggle}
      className="relative flex items-center justify-center w-[28px] h-[28px] rounded-full bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] before:absolute before:inset-[-8px] before:content-['']"
      whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.2)", scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={springs.snappy}
      aria-label={isMuted ? "Unmute" : "Mute"}
    >
      {isMuted ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 010 14.14" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
        </svg>
      )}
    </motion.button>
  );
}
