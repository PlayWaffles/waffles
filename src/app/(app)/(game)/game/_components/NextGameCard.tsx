"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useAnimation } from "framer-motion";

import { WaffleButton } from "@/components/buttons/WaffleButton";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useUser } from "@/hooks/useUser";
import { useTimer } from "@/hooks/useTimer";
import { springs } from "@/lib/animations";
import type { GameWithQuestionCount } from "@/lib/game";

import { BuyTicketModal } from "./BuyTicketModal";

// ==========================================
// TYPES
// ==========================================

interface NextGameCardProps {
  /** Game data from server component */
  game: GameWithQuestionCount;
}

// ==========================================
// COMPONENT
// ==========================================

export function NextGameCard({ game }: NextGameCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get real-time state from context (entry, stats, players)
  const {
    state: {
      entry,
      isLoadingEntry,
      prizePool: storePrizePool,
      playerCount: storePlayerCount,
      entrants,
    },
    refetchEntry,
  } = useRealtime();

  // Get user data
  const { user } = useUser();

  // Realtime stats from context (updated via WebSocket), fallback to game prop
  const prizePool = storePrizePool ?? game.prizePool ?? 0;
  const playerCount = storePlayerCount ?? game.playerCount ?? 0;
  const spotsTotal = game.maxPlayers ?? 500;

  const now = Date.now();
  const hasEnded = now >= game.endsAt.getTime();
  const isLive = !hasEnded && now >= game.startsAt.getTime();

  // Timer - countdown to start or end
  const targetMs = isLive ? game.endsAt.getTime() : game.startsAt.getTime();
  const countdown = useTimer(targetMs);

  // Derived state
  const hasTicket = !!entry?.hasTicket;

  // Check if player has answered all questions (finished playing)
  const hasFinishedAnswering =
    hasTicket &&
    game.questionCount &&
    entry?.answeredQuestionIds &&
    entry.answeredQuestionIds.length >= game.questionCount;

  // Animation controls
  const prevPrizePool = useRef(prizePool);
  const prevSpotsTaken = useRef(playerCount);
  const prizeControls = useAnimation();
  const spotsControls = useAnimation();

  useEffect(() => {
    if (prevPrizePool.current !== prizePool) {
      prizeControls.start({
        scale: [1, 1.2, 1],
        color: ["#FFFFFF", "#F5BB1B", "#FFFFFF"],
        transition: { duration: 0.4, ease: "easeOut" as const },
      });
      prevPrizePool.current = prizePool;
    }
  }, [prizePool, prizeControls]);

  useEffect(() => {
    if (prevSpotsTaken.current !== playerCount) {
      spotsControls.start({
        scale: [1, 1.15, 1],
        transition: { duration: 0.3, ease: "easeOut" as const },
      });
      prevSpotsTaken.current = playerCount;
    }
  }, [playerCount, spotsControls]);

  // Format countdown
  const pad = (n: number) => String(n).padStart(2, "0");
  const countdownDisplay = `${pad(Math.floor(countdown / 3600))}H ${pad(
    Math.floor((countdown % 3600) / 60)
  )}M ${pad(countdown % 60)}S`;

  // Button config - show loading while checking entry to prevent flash
  const buttonConfig = isLoadingEntry
    ? { text: "LOADING...", disabled: true, href: null }
    : hasEnded
      ? {
        text: "VIEW RESULTS",
        disabled: false,
        href: `/game/${game.id}/result`,
      }
      : isLive
        ? hasTicket
          ? hasFinishedAnswering
            ? {
              text: "WAITING...",
              disabled: false,
              href: `/game/${game.id}/live`,
            }
            : { text: "PLAY NOW", disabled: false, href: `/game/${game.id}/live` }
          : { text: "GET TICKET", disabled: false, href: null }
        : hasTicket
          ? { text: "YOU'RE IN!", disabled: true, href: null }
          : {
              text: `BUY WAFFLE - $${game.pricing.currentPrice.toFixed(2)}`,
              disabled: false,
              href: null,
            };

  const handleButtonClick = () => {
    if (buttonConfig.disabled) return;
    if (buttonConfig.href) {
      router.push(buttonConfig.href);
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springs.gentle}
        whileHover={{ scale: 1.01 }}
        className="relative w-full max-w-[361px] mx-auto rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "rgba(21, 21, 25, 0.5)",
          boxShadow: "0px 5px 5.2px 8px rgba(12, 12, 14, 0.5)",
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...springs.bouncy }}
          className="relative flex flex-col justify-center items-center shrink-0 z-10 w-full h-[52px]"
          style={{
            background: "rgba(27, 27, 29, 0.8)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-row justify-center items-center gap-3 h-[30px]">
            <motion.div
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <Image
                src="/images/icons/game-controller.png"
                alt="controller"
                width={30}
                height={30}
              />
            </motion.div>
            <span className="font-body text-white uppercase text-[26px] leading-[92%] tracking-[-0.03em]">
              WAFFLES #{(game.gameNumber ?? 0).toString().padStart(3, "0")}
            </span>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative flex flex-row items-start z-10 shrink-0 px-2.5 pt-3 gap-3"
        >
          <StatBlock
            icon="/images/illustrations/spots.svg"
            iconSize={{ w: 55.12, h: 40 }}
            label="Spots"
            value={`${playerCount}/${spotsTotal}`}
            animateControls={spotsControls}
          />
          <StatBlock
            icon="/images/illustrations/money-stack.svg"
            iconSize={{ w: 38.32, h: 40 }}
            label="Prize pool"
            value={`$${prizePool.toLocaleString()}`}
            animateControls={prizeControls}
          />
        </motion.div>

        {/* Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, ...springs.bouncy }}
          className="relative flex justify-center items-center px-4 py-2 z-10 shrink-0"
        >
          <WaffleButton
            disabled={buttonConfig.disabled}
            onClick={handleButtonClick}
          >
            {buttonConfig.text}
          </WaffleButton>
        </motion.div>

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, ...springs.gentle }}
          className="flex flex-col justify-center items-center z-10 shrink-0 w-full pt-2 gap-1.5"
        >
          <motion.div
            animate={{
              boxShadow: [
                "0 0 0px rgba(245, 187, 27, 0)",
                "0 0 15px rgba(245, 187, 27, 0.4)",
                "0 0 0px rgba(245, 187, 27, 0)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut" as const,
            }}
            className="flex flex-row justify-center items-center px-5 py-2.5 min-w-[158px] h-[44px] border-2 border-[#F5BB1B] rounded-full"
          >
            <motion.span
              key={countdown}
              initial={{ scale: 1.1, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-body text-center text-[#F5BB1B] text-lg"
            >
              {countdownDisplay}
            </motion.span>
          </motion.div>
          <span className="font-display text-center text-white/50 text-xs">
            {hasEnded
              ? "Game has ended"
              : isLive
                ? "Until game ends"
                : "Until game starts"}
          </span>
        </motion.div>

        {/* Player Avatars Row - matches Figma design */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-row justify-center items-center w-full px-4 pb-4 mt-4 gap-1.5"
          style={{ minHeight: "25px" }}
        >
          {/* Avatar Stack */}
          {entrants.length > 0 && (
            <div className="flex flex-row items-center">
              {entrants.slice(0, 4).map((player, index) => (
                <motion.div
                  key={player.username}
                  initial={{ opacity: 0, scale: 0, x: -10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 20,
                    delay: 0.7 + index * 0.08,
                  }}
                  className="box-border w-[25px] h-[25px] rounded-full border-2 border-white overflow-hidden bg-[#F0F3F4] shrink-0"
                  style={{
                    marginLeft: index > 0 ? "-10px" : "0",
                    zIndex: 4 - index,
                  }}
                >
                  {player.pfpUrl ? (
                    <Image
                      src={player.pfpUrl}
                      alt=""
                      width={25}
                      height={25}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-[#F5BB1B] to-[#FF6B35]" />
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Text */}
          <motion.span
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
            className="font-display font-medium text-sm text-center tracking-[-0.03em] text-[#99A0AE]"
            style={{ lineHeight: "130%" }}
          >
            {playerCount === 0
              ? "Be the first to join!"
              : playerCount === 1
                ? "1 player has joined"
                : `and ${Math.max(
                  0,
                  playerCount - entrants.slice(0, 4).length
                )} others have joined the game`}
          </motion.span>
        </motion.div>
      </motion.div>

      <BuyTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gameId={game.id}
        onchainId={(game.onchainId as `0x${string}`) ?? null}
        theme={game.theme ?? ""}
        themeIcon={game.coverUrl ?? undefined}
        pricing={game.pricing}
        onPurchaseSuccess={() => {
          refetchEntry();
        }}
        username={user?.username ?? undefined}
        userAvatar={user?.pfpUrl ?? undefined}
      />
    </>
  );
}

// ==========================================
// STAT BLOCK
// ==========================================

function StatBlock({
  icon,
  iconSize,
  label,
  value,
  animateControls,
}: {
  icon: string;
  iconSize: { w: number; h: number };
  label: string;
  value: string;
  animateControls?: ReturnType<typeof useAnimation>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05, y: -3 }}
      className="flex flex-col justify-center items-center flex-1 h-[85px]"
    >
      <Image src={icon} alt={label} width={iconSize.w} height={iconSize.h} />
      <span className="font-display text-center text-[#99A0AE] text-base">
        {label}
      </span>
      <motion.span
        animate={animateControls}
        className="font-body text-white text-2xl"
      >
        {value}
      </motion.span>
    </motion.div>
  );
}
