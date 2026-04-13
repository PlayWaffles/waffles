"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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

const pad = (n: number) => String(n).padStart(2, "0");

const MINIPAY_ADD_CASH_URL = "https://minipay.opera.com/add_cash";

// ==========================================
// SCARCITY TIERS — percentage-based
// ==========================================
type ScarcityTier = "plenty" | "filling" | "scarce" | "critical" | "soldOut";

function getScarcityTier(spotsLeft: number, total: number): ScarcityTier {
  if (spotsLeft <= 0) return "soldOut";
  const pctRemaining = (spotsLeft / total) * 100;
  if (pctRemaining <= 10) return "critical"; // last ~3 spots of 30
  if (pctRemaining <= 33) return "scarce";   // under 10 of 30
  if (pctRemaining <= 60) return "filling";  // under 18 of 30
  return "plenty";
}

const scarcityStyles: Record<ScarcityTier, {
  textClass: string;
  pulseClass: string;
  bgTint: string;
  borderTint: string;
}> = {
  plenty: {
    textClass: "text-white",
    pulseClass: "",
    bgTint: "rgba(255, 255, 255, 0.04)",
    borderTint: "rgba(255, 255, 255, 0.06)",
  },
  filling: {
    textClass: "text-waffle-gold",
    pulseClass: "",
    bgTint: "rgba(245, 187, 27, 0.06)",
    borderTint: "rgba(245, 187, 27, 0.12)",
  },
  scarce: {
    textClass: "text-waffle-gold",
    pulseClass: "animate-pulse",
    bgTint: "rgba(245, 187, 27, 0.10)",
    borderTint: "rgba(245, 187, 27, 0.20)",
  },
  critical: {
    textClass: "text-danger-soft",
    pulseClass: "animate-pulse",
    bgTint: "rgba(255, 107, 107, 0.10)",
    borderTint: "rgba(255, 107, 107, 0.20)",
  },
  soldOut: {
    textClass: "text-white/40",
    pulseClass: "",
    bgTint: "rgba(255, 255, 255, 0.02)",
    borderTint: "rgba(255, 255, 255, 0.04)",
  },
};

// ==========================================
// COMPONENT
// ==========================================
interface NextGameCardProps {
  game: GameWithQuestionCount;
}

export function NextGameCard({ game }: NextGameCardProps) {
  const router = useRouter();
  const gameLabel = formatGameLabel(game.gameNumber);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Realtime state
  const {
    state: {
      entry,
      isLoadingEntry,
      prizePool: storePrizePool,
      playerCount: storePlayerCount,
    },
    refetchEntry,
  } = useRealtime();

  const { user } = useUser();
  const [runtime, setRuntime] = useState<AppRuntime>("browser");

  useEffect(() => {
    getAppRuntime()
      .then(setRuntime)
      .catch(() => setRuntime(isMiniPayRuntime() ? "minipay" : "browser"));
  }, []);

  // Stats
  const prizePool = storePrizePool ?? game.prizePool ?? 0;
  const playerCount = storePlayerCount ?? game.playerCount ?? 0;
  const spotsTotal = game.maxPlayers ?? 500;
  const spotsLeft = Math.max(0, spotsTotal - playerCount);

  // Game state
  const now = Date.now();
  const hasEnded = now >= game.endsAt.getTime();
  const isLive = !hasEnded && now >= game.startsAt.getTime();
  const ticketsCloseAt = getTicketCloseTime(game.endsAt).getTime();
  const ticketsOpenAt = game.ticketsOpenAt ? new Date(game.ticketsOpenAt).getTime() : null;
  const ticketsNotYetOpen = ticketsOpenAt !== null && now < ticketsOpenAt;
  const hasTicket = !!entry?.hasTicket;
  const ticketsClosed = !hasTicket && now >= ticketsCloseAt;

  // Timer
  const targetMs = isLive ? game.endsAt.getTime() : game.startsAt.getTime();
  const countdown = useTimer(targetMs);
  const hours = pad(Math.floor(countdown / 3600));
  const minutes = pad(Math.floor((countdown % 3600) / 60));
  const seconds = pad(countdown % 60);

  const hasFinishedAnswering =
    hasTicket &&
    game.questionCount &&
    entry?.answeredQuestionIds &&
    entry.answeredQuestionIds.length >= game.questionCount;

  // Scarcity
  const tier = getScarcityTier(spotsLeft, spotsTotal);
  const styles = scarcityStyles[tier];

  // Prize pool animation
  const prevPrizePool = useRef(prizePool);
  const prizeControls = useAnimation();
  useEffect(() => {
    if (prevPrizePool.current !== prizePool) {
      prizeControls.start({
        scale: [1, 1.15, 1],
        transition: { duration: 0.3, ease: "easeOut" },
      });
      prevPrizePool.current = prizePool;
    }
  }, [prizePool, prizeControls]);

  // ==========================================
  // 1-TAP PURCHASE — inline, no modal
  // ==========================================
  const openMiniPayAddCash = () => {
    if (runtime !== "minipay" && !isMiniPayRuntime()) return;
    notify.info("Opening MiniPay Add Cash...");
    window.location.assign(MINIPAY_ADD_CASH_URL);
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

  // Auto-connect wallet when user wants to buy
  useEffect(() => {
    if (runtime !== "farcaster" && !isConnected && connectors.length > 0) {
      connect({
        connector: connectors.find((c) => c.id === "injected") || connectors[0],
      });
    }
  }, [runtime, isConnected, connect, connectors]);

  // Redirect on success
  useEffect(() => {
    if (purchaseSuccess) {
      const params = new URLSearchParams();
      if (user?.username) params.set("username", user.username);
      if (user?.pfpUrl) params.set("pfpUrl", user.pfpUrl);
      router.push(`/game/${game.id}/ticket/success${params.size > 0 ? `?${params}` : ""}`);
    }
  }, [purchaseSuccess, game.id, router, user?.username, user?.pfpUrl]);

  const isWalletReady = isConnected && !!address;
  const isFarcasterWalletLoading =
    runtime === "farcaster" && !isWalletReady && !isPurchasing && !purchaseError;
  const selectedPrice = game.pricing.currentPrice;

  // ==========================================
  // BUTTON CONFIG
  // ==========================================
  const canBuyTicket =
    !hasTicket && !hookHasTicket && !hasEnded && !ticketsClosed && !ticketsNotYetOpen && !salesClosed;

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

    if (hasTicket || hookHasTicket) {
      const params = new URLSearchParams();
      if (user?.username) params.set("username", user.username);
      if (user?.pfpUrl) params.set("pfpUrl", user.pfpUrl);
      return { text: "YOU'RE IN", disabled: false, action: "navigate" as const, href: `/game/${game.id}/ticket/success${params.size > 0 ? `?${params}` : ""}` };
    }

    // Purchase states
    if (isPurchasing) {
      return { text: getPurchaseButtonText(purchaseStep, selectedPrice), disabled: true, action: "none" as const };
    }
    if (purchaseError) {
      return { text: "TRY AGAIN", disabled: false, action: "buy" as const };
    }
    if (!isWalletReady) {
      return {
        text: isFarcasterWalletLoading ? "LOADING WALLET..." : "CONNECTING...",
        disabled: true,
        action: "none" as const,
      };
    }

    return { text: `BUY TICKET — $${selectedPrice}`, disabled: false, action: "buy" as const };
  }, [
    isLoadingEntry, hasEnded, isLive, hasTicket, hookHasTicket, hasFinishedAnswering,
    ticketsClosed, ticketsNotYetOpen, salesClosed, isPurchasing, purchaseError,
    purchaseStep, selectedPrice, isWalletReady, isFarcasterWalletLoading,
    game.id, user?.username, user?.pfpUrl,
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

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springs.gentle}
      className="relative w-full md:max-w-[361px] mx-auto rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: styles.bgTint,
        border: `1px solid ${styles.borderTint}`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      }}
    >
      {/* Game label */}
      <div className="flex items-center justify-center gap-2 w-full px-4 pt-4 pb-1 z-10">
        <span className="font-body text-[16px] text-white tracking-[0.04em]">
          {gameLabel}
        </span>
      </div>

      {/* Countdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ...springs.gentle }}
        className="flex flex-col items-center z-10 shrink-0 w-full px-4 pt-1 pb-3"
      >
        <span className="font-display text-[10px] uppercase tracking-[0.18em] text-white/35 mb-2">
          {hasEnded ? "Game has ended" : isLive ? "Game ends in" : "Game starts in"}
        </span>
        <div className="flex items-center gap-2">
          <CountdownUnit value={hours} label="HRS" />
          <span className="font-body text-white/20 text-lg mt-[-12px]">:</span>
          <CountdownUnit value={minutes} label="MIN" />
          <span className="font-body text-white/20 text-lg mt-[-12px]">:</span>
          <CountdownUnit value={seconds} label="SEC" />
        </div>
      </motion.div>

      {/* SPOTS LEFT — dominant scarcity element */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col items-center z-10 shrink-0 px-4 pb-4"
      >
        <div className={`flex items-baseline gap-2 ${styles.pulseClass}`}>
          <motion.span
            className={`font-body text-[36px] leading-none tabular-nums ${styles.textClass}`}
            key={spotsLeft}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            {tier === "soldOut" ? "SOLD OUT" : spotsLeft}
          </motion.span>
          {tier !== "soldOut" && (
            <span className={`font-display text-[13px] uppercase tracking-[0.08em] ${styles.textClass} opacity-60`}>
              {spotsLeft === 1 ? "spot left" : "spots left"}
            </span>
          )}
        </div>

        {tier === "critical" && spotsLeft > 0 && (
          <motion.span
            className="font-display text-[11px] uppercase tracking-[0.15em] text-danger-soft mt-1"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            Almost gone
          </motion.span>
        )}
      </motion.div>

      {/* Prize pool — secondary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-2 z-10 shrink-0 px-4 pb-4"
      >
        <span className="font-display text-[11px] uppercase tracking-[0.08em] text-white/40">
          Prize pool
        </span>
        <motion.span
          animate={prizeControls}
          className="font-body text-white text-[20px] leading-none"
        >
          ${prizePool.toLocaleString()}
        </motion.span>
      </motion.div>

      {/* CTA — 1-tap purchase, inline */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.35, ...springs.gentle }}
        className="relative flex flex-col items-center px-4 pb-4 z-10 shrink-0 gap-2"
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
            className="text-danger-soft text-xs font-display text-center"
          >
            {purchaseErrorMsg === "Insufficient funds"
              ? "Not enough USDC."
              : purchaseErrorMsg === "Transaction rejected"
                ? "Transaction cancelled."
                : purchaseErrorMsg}
            {" "}Tap to try again.
          </motion.p>
        )}

        {/* Sold out → notification prompt */}
        {(tier === "soldOut" || ticketsClosed || salesClosed) && !hasTicket && (
          <span className="font-display text-[11px] text-white/30 text-center">
            Enable notifications for next game
          </span>
        )}
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// COUNTDOWN UNIT
// ==========================================
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
