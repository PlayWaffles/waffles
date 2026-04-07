"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type PurchaseStep =
  | "idle"
  | "pending"
  | "confirming"
  | "syncing"
  | "error";

export type TicketTier = "free" | "paid";

const TIER_CONFIG = {
  free: {
    selected:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.52) 100%)",
    unselected:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 100%)",
    border:
      "linear-gradient(157.31deg, rgba(255, 255, 255, 0.09) 26.56%, rgba(255, 255, 255, 0.5) 114.33%)",
    glow: "rgba(255, 255, 255, 0.3)",
  },
  paid: {
    selected:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,201,49,0.52) 100%)",
    unselected:
      "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,201,49,0.12) 100%)",
    border:
      "linear-gradient(157.31deg, rgba(255, 201, 49, 0.09) 26.56%, #FFC931 114.33%)",
    glow: "rgba(255, 201, 49, 0.4)",
  },
} as const;

interface PurchaseViewProps {
  theme: string;
  themeIcon?: string;
  currentPrice: number;
  potentialPayout: number;
  selectedTier: TicketTier;
  onSelectTier: (tier: TicketTier) => void;
  hasUsedFreeTicket?: boolean;
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
  selectedTier,
  onSelectTier,
  hasUsedFreeTicket = false,
  isLoading,
  isError,
  step,
  buttonText,
  isButtonDisabled,
  onPurchase,
}: PurchaseViewProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showTiers, setShowTiers] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<TicketTier | null>(null);

  useEffect(() => {
    const timer1 = setTimeout(() => setIsVisible(true), 50);
    const timer2 = setTimeout(() => setShowTiers(true), 200);
    const timer3 = setTimeout(() => setShowButton(true), 400);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const allTiers: { key: TicketTier; label: string; price: string; sublabel: string }[] = [
    { key: "paid", label: "PAID", price: `$${currentPrice}`, sublabel: "Prize eligible" },
    { key: "free", label: "FREE", price: "$0", sublabel: "Play only" },
  ];

  const tiers = hasUsedFreeTicket
    ? allTiers.filter((t) => t.key !== "free")
    : allTiers;

  return (
    <>
      {/* Choose Tier Title */}
      <h2
        className="font-body text-white text-center w-full"
        style={{
          marginTop: "12px",
          fontSize: "clamp(18px, 4vw, 22px)",
          lineHeight: "92%",
          letterSpacing: "-0.03em",
          opacity: showTiers ? 1 : 0,
          transform: showTiers ? "translateY(0)" : "translateY(10px)",
          transition: "all 0.4s ease",
        }}
      >
        CHOOSE YOUR TICKET
      </h2>

      {/* Tier Cards */}
      <div
        className="flex w-full max-w-[361px]"
        style={{ gap: "clamp(10px, 3vw, 16px)" }}
      >
        {tiers.map((tier, index) => {
          const gradient = TIER_CONFIG[tier.key];
          const isSelected = selectedTier === tier.key;
          const isHovered = hoveredTier === tier.key;
          const delay = index * 120;

          return (
            <div
              key={tier.key}
              className="relative flex-1"
              style={{
                opacity: showTiers
                  ? isLoading
                    ? 0.5
                    : isSelected
                      ? 1
                      : 0.7
                  : 0,
                transform: showTiers
                  ? isSelected
                    ? "scale(1.05)"
                    : isHovered
                      ? "scale(1.03) translateY(-4px)"
                      : "scale(1)"
                  : "translateY(20px) scale(0.9)",
                transition: `all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
              }}
            >
              {/* Gradient border layer */}
              <div
                className="absolute inset-0 rounded-[24px] pointer-events-none"
                style={{
                  padding: "1px",
                  background: gradient.border,
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />
              <button
                onClick={() => !isLoading && onSelectTier(tier.key)}
                disabled={isLoading}
                onMouseEnter={() => setHoveredTier(tier.key)}
                onMouseLeave={() => setHoveredTier(null)}
                className="flex flex-col justify-center items-center w-full box-border"
                style={{
                  background: isSelected
                    ? gradient.selected
                    : gradient.unselected,
                  height: "120px",
                  padding: "14px",
                  gap: "8px",
                  borderRadius: "24px",
                  boxShadow: isSelected
                    ? `0 8px 30px ${gradient.glow}`
                    : isHovered
                      ? `0 6px 20px ${gradient.glow}`
                      : "none",
                  transition: "all 0.3s ease",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {/* Waffle icon */}
                <div
                  className="flex justify-center items-center"
                  style={{
                    width: "40px",
                    height: "40px",
                    background: isSelected
                      ? "rgba(255, 255, 255, 0.2)"
                      : "rgba(255, 255, 255, 0.1)",
                    borderRadius: "200px",
                    transition: "all 0.3s ease",
                    transform: isSelected ? "rotate(10deg)" : "rotate(0deg)",
                  }}
                >
                  <Image
                    src="/images/icons/waffle-small.png"
                    alt="waffle"
                    width={16}
                    height={12}
                    className="object-contain"
                    style={{
                      transition: "transform 0.3s ease",
                      transform: isSelected ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                </div>
                {/* Price */}
                <span
                  className="font-body text-white"
                  style={{
                    fontSize: isSelected ? "30px" : "28px",
                    lineHeight: "100%",
                    transition: "all 0.3s ease",
                    textShadow: isSelected
                      ? "0 2px 10px rgba(255,255,255,0.3)"
                      : "none",
                  }}
                >
                  {tier.price}
                </span>
                {/* Sublabel */}
                <span
                  className="font-display text-white/50"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {tier.sublabel}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Buy Button */}
      <div
        className="w-full max-w-[361px]"
        style={{
          opacity: showButton ? 1 : 0,
          transform: showButton ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <button
          onClick={onPurchase}
          disabled={isButtonDisabled}
          className="relative flex items-center justify-center px-6 bg-white text-[#191919] font-body font-normal uppercase tracking-[-0.02em] text-center leading-[115%] w-full rounded-[12px] border-[5px] border-t-0 border-l-0 border-(--brand-cyan) disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
          style={{
            height: "clamp(44px, 8vh, 54px)",
            fontSize: "clamp(20px, 4vw, 26px)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!isButtonDisabled) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 8px 25px rgba(0, 207, 242, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
          onMouseDown={(e) => {
            if (!isButtonDisabled) {
              e.currentTarget.style.transform = "translateY(0) scale(0.98)";
            }
          }}
          onMouseUp={(e) => {
            if (!isButtonDisabled) {
              e.currentTarget.style.transform = "translateY(-2px) scale(1)";
            }
          }}
        >
          {/* Shimmer effect when loading */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
              transform: "translateX(-100%)",
              animation: isLoading
                ? "button-shimmer 1.5s ease-in-out infinite"
                : "none",
            }}
          />
          <span style={{ position: "relative", zIndex: 1 }}>{buttonText}</span>
        </button>
      </div>

      {/* Status Message */}
      {step !== "idle" && step !== "error" && (
        <p
          className="text-white/50 text-xs text-center"
          style={{ animation: "pulse-fade 1.5s ease-in-out infinite" }}
        >
          {step === "pending" && "Please confirm in your wallet..."}
          {step === "confirming" && "Waiting for confirmation..."}
          {step === "syncing" && "Finalizing purchase..."}
        </p>
      )}

      {/* Error Message */}
      {isError && (
        <p
          className="text-red-400 text-sm text-center"
          style={{ animation: "shake 0.5s ease-in-out" }}
        >
          Something went wrong. Please try again.
        </p>
      )}

      {/* Potential Payout (only visible when paid tier selected) */}
      <div
        className="flex justify-between items-center w-full max-w-[361px] rounded-2xl"
        style={{
          background:
            selectedTier === "paid"
              ? "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(27, 245, 176, 0.12) 100%)"
              : "linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.05) 100%)",
          padding: "clamp(8px, 2vh, 12px) clamp(12px, 3vw, 16px)",
          opacity: showButton ? 1 : 0,
          transform: showButton ? "translateY(0)" : "translateY(10px)",
          transition: "all 0.5s ease 100ms",
        }}
      >
        <span
          className="font-display text-white"
          style={{ fontSize: "clamp(10px, 2vw, 12px)", opacity: 0.5 }}
        >
          {selectedTier === "paid" ? "Potential payout" : "Play for fun"}
        </span>
        <span
          className="font-body"
          style={{
            fontSize: "clamp(18px, 4vw, 22px)",
            color: selectedTier === "paid" ? "#14B985" : "rgba(255,255,255,0.4)",
            transition: "all 0.3s ease",
          }}
        >
          {selectedTier === "paid" ? `$${potentialPayout}` : "No prizes"}
        </span>
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-5px) rotate(5deg);
          }
        }
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-5px);
          }
          40% {
            transform: translateX(5px);
          }
          60% {
            transform: translateX(-3px);
          }
          80% {
            transform: translateX(3px);
          }
        }
        @keyframes button-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        @keyframes pulse-fade {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
