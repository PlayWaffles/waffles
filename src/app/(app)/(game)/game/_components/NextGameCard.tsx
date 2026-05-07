"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { motion, useAnimation, AnimatePresence } from "framer-motion";

import { WaffleButton } from "@/components/buttons/WaffleButton";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useUser } from "@/hooks/useUser";
import { useTimer } from "@/hooks/useTimer";
import {
  useTicketPurchase,
  getPurchaseButtonText,
} from "@/hooks/useTicketPurchase";
import { springs } from "@/lib/animations";
import { notify } from "@/components/ui/Toaster";
import type { GameWithQuestionCount } from "@/lib/game";
import { formatGameLabel } from "@/lib/game/labels";
import { getTicketCloseTime } from "@/lib/game/ticket-window";
import {
  getAppRuntime,
  isMiniPayRuntime,
  type AppRuntime,
} from "@/lib/client/runtime";
import {
  MINIPAY_DEPOSIT_URL,
  MINIPAY_LOW_BALANCE_MESSAGE,
  MINIPAY_USDT_ONLY_MESSAGE,
} from "@/lib/minipay/compliance";

const pad = (n: number) => String(n).padStart(2, "0");

interface NextGameCardProps {
  game: GameWithQuestionCount;
}

// Scarcity color tiers (percentage-based)
function getScarcityColor(spotsLeft: number, total: number): string {
  if (spotsLeft <= 0) return "rgba(255, 255, 255, 0.04)";
  const pct = (spotsLeft / total) * 100;
  if (pct <= 10) return "rgba(255, 107, 107, 0.12)"; // critical — red tint
  if (pct <= 33) return "rgba(245, 187, 27, 0.10)";  // scarce — gold tint
  if (pct <= 60) return "rgba(245, 187, 27, 0.06)";  // filling — subtle gold
  return "rgba(255, 255, 255, 0.04)";                  // plenty — neutral
}

function getScarcityTextClass(spotsLeft: number, total: number): string {
  if (spotsLeft <= 0) return "text-white/40";
  const pct = (spotsLeft / total) * 100;
  if (pct <= 10) return "text-danger-soft";
  if (pct <= 33) return "text-waffle-gold";
  return "text-white";
}

export function NextGameCard({ game }: NextGameCardProps) {
  const router = useRouter();
  const gameLabel = formatGameLabel(game.gameNumber);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

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

  const [runtime, setRuntime] = useState<AppRuntime>("browser");
  useEffect(() => {
    getAppRuntime()
      .then(setRuntime)
      .catch(() => setRuntime(isMiniPayRuntime() ? "minipay" : "browser"));
  }, []);

  // Realtime stats from context (updated via WebSocket), fallback to game prop
  const prizePool = storePrizePool ?? game.prizePool ?? 0;
  const playerCount = storePlayerCount ?? game.playerCount ?? 0;
  const spotsTotal = game.maxPlayers ?? 500;
  const spotsLeft = Math.max(0, spotsTotal - playerCount);
  const fillPercent = Math.min(100, (playerCount / spotsTotal) * 100);

  const now = Date.now();
  const hasEnded = now >= game.endsAt.getTime();
  const isLive = !hasEnded && now >= game.startsAt.getTime();
  const ticketsCloseAt = getTicketCloseTime(game.endsAt).getTime();

  // Ticket availability
  const ticketsOpenAt = game.ticketsOpenAt ? new Date(game.ticketsOpenAt).getTime() : null;
  const ticketsNotYetOpen = ticketsOpenAt !== null && now < ticketsOpenAt;
  const hasTicket = !!entry?.hasTicket;
  const ticketsClosed = !hasTicket && now >= ticketsCloseAt;

  // Timer - always count to game start before kickoff, then to game end once live
  const targetMs = isLive ? game.endsAt.getTime() : game.startsAt.getTime();
  const countdown = useTimer(targetMs);

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
        transition: { duration: 0.4, ease: "easeOut" },
      });
      prevPrizePool.current = prizePool;
    }
  }, [prizePool, prizeControls]);

  useEffect(() => {
    if (prevSpotsTaken.current !== playerCount) {
      spotsControls.start({
        scale: [1, 1.15, 1],
        transition: { duration: 0.3, ease: "easeOut" },
      });
      prevSpotsTaken.current = playerCount;
    }
  }, [playerCount, spotsControls]);

  const hours = pad(Math.floor(countdown / 3600));
  const minutes = pad(Math.floor((countdown % 3600) / 60));
  const seconds = pad(countdown % 60);
  const ticketSuccessParams = new URLSearchParams();

  if (user?.username) {
    ticketSuccessParams.set("username", user.username);
  }

  if (user?.pfpUrl) {
    ticketSuccessParams.set("pfpUrl", user.pfpUrl);
  }

  const ticketSuccessHref = `/game/${game.id}/ticket/success${ticketSuccessParams.size > 0 ? `?${ticketSuccessParams.toString()}` : ""}`;

  // ── 1-tap purchase (inline, no modal) ──────────────
  const openMiniPayAddCash = () => {
    if (runtime !== "minipay" && !isMiniPayRuntime()) return;
    notify.info("Opening MiniPay Deposit...");
    window.location.assign(MINIPAY_DEPOSIT_URL);
  };

  const {
    step: purchaseStep,
    isLoading: isPurchasing,
    isSuccess: purchaseSuccess,
    isError: purchaseError,
    error: purchaseErrorMsg,
    salesClosed,
    purchase,
    reset: resetPurchase,
    hasTicket: hookHasTicket,
  } = useTicketPurchase(
    game.id,
    game.platform,
    game.network,
    (game.onchainId as `0x${string}`) ?? null,
    game.pricing.currentPrice,
    () => refetchEntry(),
    openMiniPayAddCash,
  );

  // Auto-connect wallet
  useEffect(() => {
    if (runtime !== "farcaster" && !isConnected && connectors.length > 0) {
      connect({ connector: connectors.find((c) => c.id === "injected") || connectors[0] });
    }
  }, [runtime, isConnected, connect, connectors]);

  // Redirect on purchase success
  useEffect(() => {
    if (purchaseSuccess) router.push(ticketSuccessHref);
  }, [purchaseSuccess, router, ticketSuccessHref]);

  const isWalletReady = isConnected && !!address;
  const isFarcasterWalletLoading =
    runtime === "farcaster" && !isWalletReady && !isPurchasing && !purchaseError;
  const selectedPrice = game.pricing.currentPrice;

  // Button config
  const buttonConfig = useMemo(() => {
    if (isLoadingEntry) return { text: "LOADING...", disabled: true, action: "none" as const };
    if (hasEnded) return { text: "VIEW RESULTS", disabled: false, action: "navigate" as const, href: `/game/${game.id}/result` };

    if (isLive) {
      if (hasTicket) {
        return hasFinishedAnswering
          ? { text: "WAITING...", disabled: false, action: "navigate" as const, href: `/game/${game.id}/live` }
          : { text: "PLAY NOW", disabled: false, action: "navigate" as const, href: `/game/${game.id}/live` };
      }
      if (ticketsClosed || salesClosed) return { text: "SOLD OUT", disabled: true, action: "none" as const };
    }

    if (ticketsNotYetOpen) return { text: "TICKETS OPENING SOON", disabled: true, action: "none" as const };
    if (ticketsClosed || salesClosed) return { text: "SOLD OUT", disabled: true, action: "none" as const };
    if (hasTicket || hookHasTicket) return { text: "YOU'RE IN", disabled: false, action: "navigate" as const, href: ticketSuccessHref };

    if (isPurchasing) return { text: getPurchaseButtonText(purchaseStep, selectedPrice), disabled: true, action: "none" as const };
    if (purchaseError) return { text: "TRY AGAIN", disabled: false, action: "buy" as const };
    if (!isWalletReady) return { text: isFarcasterWalletLoading ? "LOADING WALLET..." : "CONNECTING...", disabled: true, action: "none" as const };

    return { text: `BUY TICKET — $${selectedPrice}`, disabled: false, action: "buy" as const };
  }, [
    isLoadingEntry, hasEnded, isLive, hasTicket, hookHasTicket, hasFinishedAnswering,
    ticketsClosed, ticketsNotYetOpen, salesClosed, isPurchasing, purchaseError,
    purchaseStep, selectedPrice, isWalletReady, isFarcasterWalletLoading,
    game.id, ticketSuccessHref,
  ]);

  const handleButtonClick = () => {
    if (buttonConfig.disabled) return;
    if (buttonConfig.action === "navigate" && "href" in buttonConfig) {
      router.push(buttonConfig.href!);
    } else if (buttonConfig.action === "buy") {
      if (purchaseError) resetPurchase();
      purchase();
    }
  };

  const visibleEntrants = entrants.slice(0, 4);

  return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={springs.gentle}
        className="relative w-full md:max-w-[361px] mx-auto rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "#0F0F10",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
        }}
      >
        {/* Game title */}
        <div className="flex items-center justify-center gap-2 w-full px-4 pt-4 pb-1 z-10">
          <span className="font-body text-[16px] text-white tracking-[0.04em]">
            {gameLabel}
          </span>
        </div>

        {/* Countdown section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, ...springs.gentle }}
          className="flex flex-col items-center z-10 shrink-0 w-full px-4 pt-1 pb-3"
        >
          <span className="font-display text-[10px] uppercase tracking-[0.18em] text-white/35 mb-2">
            {hasEnded
              ? "Game has ended"
              : isLive
                ? "Game ends in"
                : "Game starts in"}
          </span>
          <div className="flex items-center gap-2">
            <CountdownUnit value={hours} label="HRS" />
            <span className="font-body text-white/20 text-lg mt-[-12px]">:</span>
            <CountdownUnit value={minutes} label="MIN" />
            <span className="font-body text-white/20 text-lg mt-[-12px]">:</span>
            <CountdownUnit value={seconds} label="SEC" />
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="relative flex flex-row items-stretch z-10 shrink-0 mx-4 mb-4 gap-3"
        >
          <StatBlock
            icon="/images/illustrations/spots.svg"
            iconSize={{ w: 40, h: 30 }}
            label="Spots left"
            value={spotsLeft <= 0 ? "SOLD OUT" : `${spotsLeft}`}
            valueClass={getScarcityTextClass(spotsLeft, spotsTotal)}
            animateControls={spotsControls}
            fillPercent={fillPercent}
            bgOverride={getScarcityColor(spotsLeft, spotsTotal)}
          />
          <StatBlock
            icon="/images/illustrations/money-stack.svg"
            iconSize={{ w: 30, h: 30 }}
            label="Prize pool"
            value={`$${prizePool.toLocaleString()}`}
            animateControls={prizeControls}
          />
        </motion.div>

        {/* Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, ...springs.bouncy }}
          className="relative flex justify-center items-center px-4 pb-3 z-10 shrink-0"
        >
          <WaffleButton
            disabled={buttonConfig.disabled}
            onClick={handleButtonClick}
          >
            {buttonConfig.text}
          </WaffleButton>
          {/* Inline error recovery */}
          {purchaseError && purchaseErrorMsg && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-danger-soft text-xs font-display text-center mt-1"
            >
              {purchaseErrorMsg === MINIPAY_LOW_BALANCE_MESSAGE
                ? MINIPAY_LOW_BALANCE_MESSAGE
                : purchaseErrorMsg === "Transaction rejected"
                  ? "Transaction cancelled."
                  : purchaseErrorMsg}
              {" "}Tap to try again.
            </motion.p>
          )}
        </motion.div>

        <p className="px-5 pb-2 text-center font-display text-[10px] leading-snug text-white/35">
          {MINIPAY_USDT_ONLY_MESSAGE}
        </p>

        {/* Player Avatars Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-row justify-center items-center w-full px-4 pb-4 pt-1 gap-2 min-h-7"
        >
          {/* Avatar Stack */}
          <AnimatePresence>
            {visibleEntrants.length > 0 && (
              <div className="flex flex-row items-center">
                {visibleEntrants.map((player, index) => (
                  <motion.div
                    key={player.username}
                    initial={{ opacity: 0, scale: 0, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 20,
                      delay: 0.5 + index * 0.08,
                    }}
                    className="box-border w-[26px] h-[26px] rounded-full border-[1.5px] border-white/80 overflow-hidden bg-[#2A2A2E] shrink-0"
                    style={{
                      marginLeft: index > 0 ? "-8px" : "0",
                      zIndex: 4 - index,
                    }}
                  >
                    {player.pfpUrl ? (
                      <Image
                        src={player.pfpUrl}
                        alt=""
                        width={26}
                        height={26}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-linear-to-br from-waffle-gold-warm to-[#FF6B35]" />
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Text */}
          <motion.span
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="font-display text-[13px] text-center text-white/35"
          >
            {playerCount === 0
              ? "Be the first to join!"
              : playerCount === 1
                ? "1 player has joined"
                : `and ${Math.max(
                  0,
                  playerCount - visibleEntrants.length
                )} others have joined`}
          </motion.span>
        </motion.div>
      </motion.div>
  );
}

function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <motion.div
        className="flex items-center justify-center w-[52px] h-[44px] rounded-lg font-body text-[24px] text-waffle-gold-warm tabular-nums"
        style={{
          background:
            "linear-gradient(180deg, rgba(245, 187, 27, 0.1) 0%, rgba(245, 187, 27, 0.04) 100%)",
          border: "1px solid rgba(245, 187, 27, 0.15)",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={value}
            initial={{ y: -8, opacity: 0, filter: "blur(2px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 8, opacity: 0, filter: "blur(2px)" }}
            transition={{ duration: 0.25 }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </motion.div>
      <span className="font-display text-[9px] uppercase tracking-[0.15em] text-white/25">
        {label}
      </span>
    </div>
  );
}

function StatBlock({
  icon,
  iconSize,
  label,
  value,
  subValue,
  valueClass,
  animateControls,
  fillPercent,
  bgOverride,
}: {
  icon: string;
  iconSize: { w: number; h: number };
  label: string;
  value: string;
  subValue?: string;
  valueClass?: string;
  animateControls?: ReturnType<typeof useAnimation>;
  fillPercent?: number;
  bgOverride?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03, y: -2 }}
      transition={springs.gentle}
      className="relative flex flex-col items-center justify-center flex-1 py-3 px-3 rounded-xl overflow-hidden"
      style={{
        background: bgOverride
          ? `linear-gradient(180deg, ${bgOverride} 0%, rgba(255, 255, 255, 0.01) 100%)`
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Fill bar for spots */}
      {fillPercent !== undefined && (
        <motion.div
          className="absolute bottom-0 left-0 right-0"
          initial={{ height: 0 }}
          animate={{ height: `${fillPercent}%` }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
          style={{
            background:
              "linear-gradient(180deg, rgba(245, 187, 27, 0.08) 0%, rgba(245, 187, 27, 0.02) 100%)",
          }}
        />
      )}

      <Image
        src={icon}
        alt={label}
        width={iconSize.w}
        height={iconSize.h}
        className="relative z-10"
      />
      <span className="relative z-10 font-display text-center text-white/40 text-[11px] uppercase tracking-[0.08em] mt-1">
        {label}
      </span>
      <div className="relative z-10 flex items-baseline gap-1">
        <motion.span
          animate={animateControls}
          className={`font-body text-xl leading-tight ${valueClass || "text-white"}`}
        >
          {value}
        </motion.span>
        {subValue && (
          <span className="font-display text-white/25 text-xs">{subValue}</span>
        )}
      </div>
    </motion.div>
  );
}
