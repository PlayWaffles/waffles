"use client";
import { LeaveGameIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import LeaveGameDrawer from "./LeaveGameDrawer";
import { usePathname, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { WalletBalance } from "./WalletBalance";
import { useSounds } from "@/components/providers/SoundProvider";

export function GameHeader({
  title,
  isCurrentGameLive = false,
}: {
  title?: string | null;
  isCurrentGameLive?: boolean;
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
            <div className="transition-transform duration-150 ease-out hover:-rotate-3 active:scale-90">
              <Link href={`/game`} className="relative block w-[29.96px] h-[23.24px]">
                <Image
                  src="/logo-small.webp"
                  alt="Live game logo"
                  fill
                  sizes="29.96px"
                  priority
                  className="object-contain"
                />
              </Link>
            </div>

            {/* Live indicator with enhanced pulse */}
            <span className="flex items-center gap-1.5 mr-auto">
              {/* Animated pulsing dot */}
              <span className="w-2 h-2 rounded-full bg-live animate-pulse shadow-[0_0_10px_rgba(252,25,25,0.8)]" />
              <span className="text-live text-[18px] not-italic font-normal leading-[92%] tracking-[-0.03em] animate-pulse">
                Live
              </span>
            </span>
          </div>
        ) : (
          /* Logo + Title with bounce on hover */
          <div className="transition-transform duration-150 ease-out hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95">
            <Link href="/game" className="flex items-center gap-2">
              <div className="relative w-[30px] h-[24px] transition-transform duration-150 ease-out hover:-rotate-3">
                <Image
                  src="/logo-small.webp"
                  alt="Waffles logo"
                  fill
                  sizes="30px"
                  priority
                  className="object-contain"
                />
              </div>
              <span className="font-body text-[22px] leading-[92%] tracking-[-0.03em] text-white">
                WAFFLES
              </span>
              {isCurrentGameLive ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-live animate-pulse shadow-[0_0_10px_rgba(252,25,25,0.8)]" />
                  <span className="text-live text-[18px] not-italic font-normal leading-[92%] tracking-[-0.03em] animate-pulse">
                    Live
                  </span>
                </span>
              ) : (
                title && (
                  <span className="font-body text-[18px] leading-[92%] tracking-[-0.03em] text-white/50">
                    {title.replace(/^Waffles\s*/i, "")}
                  </span>
                )
              )}
            </Link>
          </div>
        )}

        <div className="flex items-center gap-2">
          <MuteButton isMuted={isMuted} onToggle={toggleMute} />
          {isLiveRoute ? (
            /* Leave Game button with interactions */
            <button
              onClick={() => setIsLeaveGameDrawerOpen(true)}
              className="flex items-center bg-white/10 rounded-full px-[12px] py-[6px] min-h-[44px] transition-[background-color,transform] duration-150 ease-out font-body hover:translate-x-0.5 hover:scale-105 hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
            >
              {/* Icon with wiggle on hover */}
              <div className="transition-transform duration-150 ease-out hover:-rotate-6">
                <LeaveGameIcon className="w-[15px] h-[15px] mr-2" />
              </div>
              <span className="text-[16px] leading-[100%] text-center text-white">
                leave game
              </span>
            </button>
          ) : (
            <WalletBalance />
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
    <button
      onClick={onToggle}
      className="relative flex items-center justify-center w-[28px] h-[28px] rounded-full bg-white/10 transition-[background-color,transform] duration-150 ease-out hover:scale-110 hover:bg-white/20 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)] before:absolute before:inset-[-8px] before:content-['']"
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
    </button>
  );
}
