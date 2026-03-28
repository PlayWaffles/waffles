"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";

import {
  useTicketPurchase,
  getPurchaseButtonText,
} from "@/hooks/useTicketPurchase";
import { PurchaseView, type PurchaseStep, type TicketTier } from "./PurchaseView";
import { useUser } from "@/hooks/useUser";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { formatAddress } from "@/lib/address";
import { notify } from "@/components/ui/Toaster";
import { playSound } from "@/lib/sounds";
import type { TicketPricingSnapshot } from "@/lib/tickets";
import type { ChainPlatform } from "@/lib/chain/platform";
import { authenticatedFetch, getAppRuntime, type AppRuntime } from "@/lib/client/runtime";

interface BuyTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  platform: ChainPlatform;
  onchainId: `0x${string}` | null;
  theme: string;
  themeIcon?: string;
  pricing: TicketPricingSnapshot;
  username?: string;
  userAvatar?: string;
  onPurchaseSuccess?: () => void;
}

export function BuyTicketModal({
  isOpen,
  onClose,
  gameId,
  platform,
  onchainId,
  theme,
  themeIcon,
  pricing,
  username = "Player",
  userAvatar,
  onPurchaseSuccess,
}: BuyTicketModalProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { user } = useUser();
  const { refetchEntry } = useRealtime();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TicketTier>("paid");
  const [freeStep, setFreeStep] = useState<PurchaseStep>("idle");
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeError, setFreeError] = useState(false);
  const [runtime, setRuntime] = useState<AppRuntime>("browser");

  // Derived display values
  const displayUsername =
    username !== "Player" ? username : user?.username || formatAddress(user?.wallet);
  const displayAvatar = userAvatar || user?.pfpUrl || undefined;
  const selectedPrice = pricing.currentPrice;
  const potentialPayout = Math.round(selectedPrice * 21.1);

  useEffect(() => {
    let cancelled = false;

    getAppRuntime()
      .then((nextRuntime) => {
        if (!cancelled) setRuntime(nextRuntime);
      })
      .catch(() => {
        if (!cancelled) setRuntime("browser");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-connect wallet when modal opens (only needed for paid tier)
  useEffect(() => {
    if (
      runtime !== "farcaster" &&
      isOpen &&
      !isConnected &&
      connectors.length > 0 &&
      selectedTier === "paid"
    ) {
      connect({
        connector: connectors.find((item) => item.id === "injected") || connectors[0],
      });
    }
  }, [runtime, isOpen, isConnected, connect, connectors, selectedTier]);

  // Use the ticket purchase hook (for paid tier)
  const {
    step: paidStep,
    isLoading: paidLoading,
    isSuccess: paidSuccess,
    isError: paidError,
    hasTicket,
    purchase,
    reset: resetPaid,
  } = useTicketPurchase(
    gameId,
    platform,
    onchainId,
    selectedPrice,
    onPurchaseSuccess,
  );

  // Redirect to success page on purchase success (paid or free)
  const redirectToSuccess = useCallback(() => {
    const successParams = new URLSearchParams();
    successParams.set("username", displayUsername);
    if (displayAvatar) {
      successParams.set("pfpUrl", displayAvatar);
    }
    router.push(`/game/${gameId}/ticket/success?${successParams.toString()}`);
  }, [gameId, displayUsername, displayAvatar, router]);

  useEffect(() => {
    if (paidSuccess) redirectToSuccess();
  }, [paidSuccess, redirectToSuccess]);

  // If user already has a ticket (detected by hook), close modal
  useEffect(() => {
    if (hasTicket && !paidSuccess) {
      onClose();
    }
  }, [hasTicket, paidSuccess, onClose]);

  // Handle modal entrance animation
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsAnimating(false);
      resetPaid();
      setFreeStep("idle");
      setFreeLoading(false);
      setFreeError(false);
    }
  }, [isOpen, resetPaid]);

  // Free ticket claim handler
  const handleClaimFree = useCallback(async () => {
    setFreeLoading(true);
    setFreeError(false);
    setFreeStep("syncing");
    try {
      const response = await authenticatedFetch(`/api/v1/games/${gameId}/free-ticket`, {
        method: "POST",
      });
      const result = (await response.json()) as
        | { success: true; entryId: string }
        | { success: false; error: string; code?: string };

      if (result.success) {
        setFreeStep("idle");
        playSound("purchase");
        notify.success("Free ticket claimed!");
        refetchEntry();
        onPurchaseSuccess?.();
        redirectToSuccess();
      } else {
        setFreeStep("error");
        setFreeError(true);
        notify.error(result.error);
      }
    } catch {
      setFreeStep("error");
      setFreeError(true);
      notify.error("Failed to claim ticket. Try again.");
    } finally {
      setFreeLoading(false);
    }
  }, [gameId, refetchEntry, onPurchaseSuccess, redirectToSuccess]);

  // Computed states based on selected tier
  const isFree = selectedTier === "free";
  const step = isFree ? freeStep : paidStep;
  const isLoading = isFree ? freeLoading : paidLoading;
  const isError = isFree ? freeError : paidError;
  const isPurchased = hasTicket || paidSuccess;
  const isWalletReady = isConnected && !!address;

  const buttonText = isFree
    ? freeLoading
      ? "CLAIMING..."
      : freeError
        ? "TRY AGAIN"
        : "PLAY FOR FREE"
    : !isWalletReady
      ? runtime === "farcaster"
        ? "Wallet unavailable"
        : "Connecting wallet..."
      : getPurchaseButtonText(paidStep, selectedPrice);

  const isButtonDisabled = isFree
    ? freeLoading || isPurchased
    : paidLoading || !onchainId || isPurchased || !isWalletReady;

  // Handle purchase button click
  const handlePurchase = () => {
    if (isFree) {
      if (freeError) {
        setFreeError(false);
        setFreeStep("idle");
      }
      handleClaimFree();
    } else {
      if (paidError) {
        resetPaid();
      } else {
        purchase();
      }
    }
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <>
      {/* Backdrop with fade animation */}
      <div
        className="fixed inset-0 z-40"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          opacity: isAnimating ? 1 : 0,
          transition: "opacity 0.3s ease",
          backdropFilter: isAnimating ? "blur(4px)" : "blur(0px)",
        }}
        onClick={handleClose}
      />

      {/* Modal with slide-up animation */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[20px] overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1E1E1E 0%, #000000 100%)",
          maxHeight: "85dvh",
          transform: isAnimating ? "translateY(0)" : "translateY(100%)",
          opacity: isAnimating ? 1 : 0,
          transition: "all 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Header with Grabber */}
        <div
          className="flex justify-center items-center shrink-0 w-full"
          style={{
            height: "clamp(48px, 8vh, 60px)",
            padding: "2px 2px 12px",
            background: "#191919",
            borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
          }}
        >
          <div
            className="w-9 h-[5px] rounded-full cursor-pointer"
            style={{
              background: "rgba(255, 255, 255, 0.4)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
              e.currentTarget.style.transform = "scaleX(1.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.4)";
              e.currentTarget.style.transform = "scaleX(1)";
            }}
            onClick={handleClose}
          />
        </div>

        {/* Content */}
        <div
          className="flex-1 flex flex-col items-center px-4 overflow-y-auto"
          style={{
            paddingBottom: "clamp(16px, 4vh, 32px)",
            gap: "clamp(12px, 3vh, 20px)",
          }}
        >
          <PurchaseView
            theme={theme}
            themeIcon={themeIcon}
            currentPrice={pricing.currentPrice}
            potentialPayout={potentialPayout}
            selectedTier={selectedTier}
            onSelectTier={setSelectedTier}
            isLoading={isLoading}
            isError={isError}
            step={step as PurchaseStep}
            buttonText={buttonText}
            isButtonDisabled={isButtonDisabled}
            onPurchase={handlePurchase}
          />
        </div>
      </div>
    </>
  );
}
