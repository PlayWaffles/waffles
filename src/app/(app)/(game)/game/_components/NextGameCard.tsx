"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useAnimation } from "framer-motion";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

import { WaffleButton } from "@/components/buttons/WaffleButton";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useUser } from "@/hooks/useUser";
import { useTimer } from "@/hooks/useTimer";
import { springs } from "@/lib/animations";
import type { GameWithQuestionCount } from "@/lib/game";
import { formatGameLabel } from "@/lib/game/labels";

import { BuyTicketModal } from "./BuyTicketModal";

const pad = (n: number) => String(n).padStart(2, "0");

interface NextGameCardProps {
  game: GameWithQuestionCount;
  howToPlayHref: string;
}

export function NextGameCard({ game, howToPlayHref }: NextGameCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const gameLabel = formatGameLabel(game.gameNumber);

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

  const { user } = useUser();

  const prizePool = storePrizePool ?? game.prizePool ?? 0;
  const playerCount = storePlayerCount ?? game.playerCount ?? 0;
  const spotsTotal = game.maxPlayers ?? 500;
  const visibleEntrants = entrants.slice(0, 4);

  const now = Date.now();
  const hasEnded = now >= game.endsAt.getTime();
  const isLive = !hasEnded && now >= game.startsAt.getTime();

  const targetMs = isLive ? game.endsAt.getTime() : game.startsAt.getTime();
  const countdown = useTimer(targetMs);

  const hasTicket = !!entry?.hasTicket;
  const hasFinishedAnswering =
    hasTicket &&
    game.questionCount &&
    entry?.answeredQuestionIds &&
    entry.answeredQuestionIds.length >= game.questionCount;

  // Animation controls for value changes
  const prevPrizePool = useRef(prizePool);
  const prevSpotsTaken = useRef(playerCount);
  const prizeControls = useAnimation();
  const spotsControls = useAnimation();

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

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

  const countdownDisplay = `${pad(Math.floor(countdown / 3600))}H ${pad(
    Math.floor((countdown % 3600) / 60)
  )}M ${pad(countdown % 60)}S`;

  const buttonConfig = isLoadingEntry
    ? { text: "LOADING...", disabled: true, href: null }
    : hasEnded
      ? { text: "VIEW RESULTS", disabled: false, href: `/game/${game.id}/result` }
      : isLive
        ? hasTicket
          ? hasFinishedAnswering
            ? { text: "WAITING...", disabled: false, href: `/game/${game.id}/live` }
            : { text: "PLAY NOW", disabled: false, href: `/game/${game.id}/live` }
          : { text: "GET TICKET", disabled: false, href: null }
        : hasTicket
          ? { text: "YOU'RE IN!", disabled: true, href: null }
          : { text: "GET TICKET", disabled: false, href: null };

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
      <div
        className="relative w-full max-w-[361px] mx-auto flex flex-col"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between w-full"
          style={{
            padding: "0 4px",
            marginBottom: "12px",
          }}
        >
          <div className="flex items-center" style={{ gap: "10px" }}>
            <Image
              src="/images/illustrations/movie-clapper.png"
              alt=""
              width={30}
              height={30}
            />
            <span
              className="font-body text-white uppercase"
              style={{
                fontSize: "clamp(22px, 5vw, 26px)",
                lineHeight: "92%",
                letterSpacing: "-0.03em",
              }}
            >
              {gameLabel}
            </span>
          </div>

          {/* Status pill */}
          <div
            className="flex items-center"
            style={{
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "100px",
              background: isLive
                ? "rgba(252, 25, 25, 0.12)"
                : "rgba(245, 187, 27, 0.1)",
              border: `1px solid ${isLive ? "rgba(252, 25, 25, 0.25)" : "rgba(245, 187, 27, 0.2)"}`,
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: isLive ? "#FC1919" : "#F5BB1B" }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: isLive ? "#FC1919" : "#F5BB1B" }}
              />
            </span>
            <span
              className="font-display uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.15em",
                color: isLive ? "#FC1919" : "#F5BB1B",
              }}
            >
              {hasEnded ? "Ended" : isLive ? "Live" : "Upcoming"}
            </span>
          </div>
        </div>

        {/* Card body */}
        <div
          className="relative w-full rounded-2xl overflow-hidden flex flex-col"
          style={{
            background:
              "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 201, 49, 0.08) 100%)",
            border: "1px solid rgba(255, 201, 49, 0.2)",
            boxShadow: isVisible ? "0 0 30px rgba(255, 201, 49, 0.08)" : "none",
          }}
        >
          {/* Stats Row */}
          <div
            className="flex w-full"
            style={{
              padding: "14px 14px 0",
              gap: "12px",
            }}
          >
            {/* Players stat */}
            <div className="flex items-center flex-1" style={{ gap: "10px" }}>
              {visibleEntrants.length > 0 ? (
                <div className="flex flex-row items-center" style={{ height: "32px" }}>
                  {visibleEntrants.map((player, index) => (
                    <div
                      key={player.username}
                      className="box-border rounded-full border-2 border-white overflow-hidden shrink-0"
                      style={{
                        width: "28px",
                        height: "28px",
                        marginLeft: index > 0 ? "-10px" : "0",
                        zIndex: visibleEntrants.length - index,
                        background: "#2A2A2E",
                      }}
                    >
                      {player.pfpUrl ? (
                        <Image
                          src={player.pfpUrl}
                          alt=""
                          width={28}
                          height={28}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: "linear-gradient(135deg, #F5BB1B 0%, #FF6B35 100%)",
                          }}
                        >
                          <span
                            className="font-display text-white/90 uppercase"
                            style={{ fontSize: "11px", lineHeight: 1 }}
                          >
                            {player.username?.charAt(0) ?? "?"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Image
                  src="/images/illustrations/spots.svg"
                  alt="spots"
                  width={40}
                  height={30}
                />
              )}
              <div className="flex flex-col" style={{ gap: "0px" }}>
                <span
                  className="font-display"
                  style={{
                    fontSize: "11px",
                    lineHeight: "130%",
                    letterSpacing: "-0.03em",
                    color: "#99A0AE",
                  }}
                >
                  Players
                </span>
                <motion.span
                  animate={spotsControls}
                  className="font-body text-white"
                  style={{ fontSize: "17px", lineHeight: "100%" }}
                >
                  {playerCount}/{spotsTotal}
                </motion.span>
              </div>
            </div>

            {/* Prize pool stat */}
            <div className="flex items-center" style={{ gap: "10px" }}>
              <Image
                src="/images/illustrations/money-stack.svg"
                alt="prize pool"
                width={30}
                height={30}
                style={{
                  animation: "bounce-subtle 2s ease-in-out infinite",
                }}
              />
              <div className="flex flex-col" style={{ gap: "0px" }}>
                <span
                  className="font-display"
                  style={{
                    fontSize: "11px",
                    lineHeight: "130%",
                    letterSpacing: "-0.03em",
                    color: "#99A0AE",
                  }}
                >
                  Prize pool
                </span>
                <motion.span
                  animate={prizeControls}
                  className="font-body text-white"
                  style={{ fontSize: "17px", lineHeight: "100%" }}
                >
                  ${prizePool.toLocaleString()}
                </motion.span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div
            className="flex flex-col items-center w-full"
            style={{ padding: "12px 14px 10px" }}
          >
            <div
              className="flex items-center justify-center w-full"
              style={{
                padding: "10px",
                borderRadius: "100px",
                border: "1.5px solid rgba(245, 187, 27, 0.4)",
                boxShadow: "0 0 15px rgba(245, 187, 27, 0.1)",
                animation: "glow-pulse 2s ease-in-out infinite",
              }}
            >
              <span
                className="font-body text-center tabular-nums"
                style={{
                  fontSize: "clamp(16px, 4vw, 20px)",
                  color: "#F5BB1B",
                  letterSpacing: "0.05em",
                }}
              >
                {countdownDisplay}
              </span>
            </div>
            <span
              className="font-display text-center"
              style={{
                fontSize: "11px",
                color: "rgba(255, 255, 255, 0.4)",
                marginTop: "6px",
              }}
            >
              {hasEnded
                ? "Game has ended"
                : isLive
                  ? "Until game ends"
                  : "Until game starts"}
            </span>
          </div>

          {/* Button */}
          <div style={{ padding: "0 14px 10px" }}>
            <WaffleButton
              disabled={buttonConfig.disabled}
              onClick={handleButtonClick}
            >
              {buttonConfig.text}
            </WaffleButton>
          </div>

          {/* How to play */}
          <div
            className="flex justify-center w-full"
            style={{ padding: "0 14px 14px" }}
          >
            <Link
              href={howToPlayHref}
              scroll={false}
              className="inline-flex items-center font-display transition-colors hover:text-[#FFC931]/70"
              style={{
                gap: "5px",
                fontSize: "12px",
                color: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <QuestionMarkCircleIcon className="w-3.5 h-3.5" />
              How to play
            </Link>
          </div>
        </div>
      </div>

      <BuyTicketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        gameId={game.id}
        platform={game.platform}
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

      <style jsx>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(245, 187, 27, 0.05); }
          50% { box-shadow: 0 0 20px rgba(245, 187, 27, 0.15); }
        }
      `}</style>
    </>
  );
}
