"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type PurchaseStep =
  | "idle"
  | "pending"
  | "confirming"
  | "syncing"
  | "error";

interface PurchaseViewProps {
  theme: string;
  themeIcon?: string;
  currentPrice: number;
  potentialPayout: number;
  isLoading: boolean;
  isError: boolean;
  step: PurchaseStep;
  buttonText: string;
  isButtonDisabled: boolean;
  onPurchase: () => void;
}

export function PurchaseView({
  theme,
  themeIcon,
  currentPrice,
  potentialPayout,
  isLoading,
  isError,
  step,
  buttonText,
  isButtonDisabled,
  onPurchase,
}: PurchaseViewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setIsVisible(true), 50);
    const timer2 = setTimeout(() => setShowCard(true), 180);
    const timer3 = setTimeout(() => setShowButton(true), 320);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <>
      <div
        className="flex flex-col items-center w-full"
        style={{
          gap: "clamp(8px, 2vh, 12px)",
          paddingTop: "clamp(12px, 3vh, 20px)",
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(-20px)",
          transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <span
          className="font-display text-white text-center"
          style={{
            fontSize: "clamp(12px, 2vw, 14px)",
            opacity: 0.6,
            letterSpacing: "-0.03em",
          }}
        >
          Next game theme
        </span>
        <div className="flex items-center gap-2.5">
          <span
            className="font-body text-white"
            style={{ fontSize: "clamp(24px, 5vw, 32px)" }}
          >
            {theme.toUpperCase()}
          </span>
          {themeIcon && (
            <Image
              src={themeIcon}
              alt={theme}
              width={41}
              height={40}
              className="object-contain"
              style={{
                width: "clamp(32px, 6vw, 41px)",
                height: "auto",
                animation: isVisible ? "float 3s ease-in-out infinite" : "none",
              }}
            />
          )}
        </div>
      </div>

      <div
        className="w-full max-w-[361px] rounded-[28px] border border-[#FFC931]/20 overflow-hidden"
        style={{
          opacity: showCard ? 1 : 0,
          transform: showCard ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.4s ease",
          background:
            "linear-gradient(180deg, rgba(255,201,49,0.12) 0%, rgba(19,19,22,0.92) 100%)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-white/45">
            Single Ticket
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div className="font-body text-[40px] leading-none text-white">
                ${currentPrice.toFixed(2)}
              </div>
            </div>
            <div className="rounded-2xl bg-white/8 px-4 py-3 text-right">
              <p className="font-display text-[11px] uppercase tracking-[0.18em] text-white/40">
                Potential payout
              </p>
              <p className="mt-1 font-body text-xl text-[#FFC931]">
                ${potentialPayout}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/70">
              One ticket type. Everyone pays ${currentPrice.toFixed(2)}.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
              <Image
                src="/images/icons/waffle-small.png"
                alt="waffle"
                width={18}
                height={14}
              />
            </div>
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.18em] text-white/40">
                Ticket unlocks
              </p>
              <p className="text-sm text-white/80">
                Game access, live play, and leaderboard placement.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className="w-full max-w-[361px]"
        style={{
          opacity: showButton ? 1 : 0,
          transform: showButton ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.4s ease",
        }}
      >
        <button
          onClick={onPurchase}
          disabled={isButtonDisabled || isLoading}
          className="w-full rounded-[24px] px-6 py-4 font-body text-lg text-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              isButtonDisabled || isLoading
                ? "rgba(255, 201, 49, 0.4)"
                : "linear-gradient(180deg, #FFD966 0%, #FFC931 100%)",
            boxShadow:
              !isButtonDisabled && !isLoading
                ? "0 18px 40px rgba(255, 201, 49, 0.24)"
                : "none",
          }}
        >
          {buttonText}
        </button>

        {isError && step === "error" && (
          <p className="mt-3 text-center text-sm text-[#FF8E8E]">
            Purchase failed. Try again.
          </p>
        )}
      </div>
    </>
  );
}
