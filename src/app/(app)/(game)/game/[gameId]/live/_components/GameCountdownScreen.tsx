"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useSounds } from "@/components/providers/SoundProvider";

// Rotation angles from design specs
const AVATAR_ROTATIONS = [-8.71, 5.85, -3.57, 7.56];

const VIDEO_URL =
  "https://res.cloudinary.com/dfqjfrf4m/video/upload/v1768850603/waffles-countdown-compressed_gjj8rv.mp4";

interface GameCountdownScreenProps {
  onComplete: () => void;
  entrants?: Array<{ pfpUrl: string | null; username?: string }>;
}

/**
 * GameCountdownScreen - Video countdown before live game
 *
 * Plays video before entering the live game.
 * Video covers full viewport below header.
 * Shows logo at top and "X people have joined the game" with avatar stack.
 */
export function GameCountdownScreen({
  onComplete,
  entrants = [],
}: GameCountdownScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const { stopBgMusic } = useSounds();

  // Stop bg music and auto-play video on mount
  useEffect(() => {
    stopBgMusic();

    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video
      .play()
      .then(() => {
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.muted = false;
            setIsMuted(false);
          }
        }, 100);
      })
      .catch(() => {
        setAutoplayFailed(true);
      });
  }, [stopBgMusic]);

  // Handle video end
  const handleEnded = useCallback(() => {
    if (hasEnded) return;
    setHasEnded(true);
    onComplete();
  }, [hasEnded, onComplete]);

  // Handle tap to play (fallback for autoplay failure)
  const handleVideoTap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (autoplayFailed) {
      video.muted = false;
      setIsMuted(false);
      video.play().catch(() => {
        // If even user-gesture play fails, just skip
        onComplete();
      });
      setAutoplayFailed(false);
      return;
    }

    if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [autoplayFailed, onComplete]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-black overflow-hidden">
      {/* Video - covers full viewport below header */}
      <video
        ref={videoRef}
        src={VIDEO_URL}
        autoPlay
        playsInline
        muted
        preload="auto"
        onEnded={handleEnded}
        onClick={handleVideoTap}
        className="absolute inset-0 w-full h-full object-cover cursor-pointer"
      />

      {/* Tap to play overlay - shown when autoplay fails */}
      {autoplayFailed && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleVideoTap}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                <path d="M22.5 12.268a2 2 0 010 3.464l-19.5 11.26A2 2 0 010 25.259V2.741A2 2 0 013 1.008l19.5 11.26z" fill="white" />
              </svg>
            </div>
            <span className="font-display text-sm text-white/70">Tap to play</span>
          </div>
        </motion.button>
      )}

      {/* Skip button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        onClick={onComplete}
        className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 font-display text-xs text-white/70 active:bg-white/20"
      >
        Skip
      </motion.button>

      {/* Logo and player stack at bottom center */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="absolute bottom-8 left-0 right-0 flex flex-col items-center justify-center z-10 gap-4"
        >
          {/* Logo with text */}
          <div className="flex flex-row items-center justify-center gap-1.5">
            <div className="relative w-8 h-8 shrink-0">
              <Image
                src="/logo.webp"
                alt="Waffles"
                fill
                sizes="48px"
                className="object-contain"
                priority
              />
            </div>
            <span className="font-body text-white text-3xl font-bold tracking-wide uppercase">
              WAFFLES
            </span>
          </div>

          {/* Player count - shows "X people have joined the game" */}
          <div className="flex flex-row justify-center items-center gap-2">
            {/* Avatar Stack - rotated rounded squares */}
            {entrants.length > 0 && (
              <div className="flex flex-row items-center">
                {entrants.slice(0, 4).map((player, index) => (
                  <motion.div
                    key={player.username || index}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotate: AVATAR_ROTATIONS[index] || 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 20,
                      delay: 0.4 + index * 0.08,
                    }}
                    className="box-border w-[21px] h-[21px] rounded-[3px] overflow-hidden bg-[#F0F3F4] shrink-0"
                    style={{
                      marginLeft: index > 0 ? "-11px" : "0",
                      zIndex: 4 - index,
                      border: "1.5px solid #FFFFFF",
                    }}
                  >
                    {player.pfpUrl ? (
                      <Image
                        src={player.pfpUrl}
                        alt=""
                        width={21}
                        height={21}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-linear-to-br from-waffle-gold-warm to-[#FF6B35]" />
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Text - "X people have joined the game" */}
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="font-display font-medium text-base text-center tracking-[-0.03em] text-[#99A0AE]"
              style={{ lineHeight: "130%" }}
            >
              {entrants.length === 0
                ? "Be the first to join!"
                : `${entrants.length} ${entrants.length === 1 ? "person has" : "people have"
                } joined the game`}
            </motion.span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default GameCountdownScreen;
