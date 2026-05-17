"use client";

import { useAccount, useConnect } from "wagmi";
import { useGetTokenBalance } from "@coinbase/onchainkit/wallet";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  getPaymentTokenAddress,
  getPlatformChain,
  PAYMENT_TOKEN_DECIMALS,
} from "@/lib/chain";
import { useCorrectChain } from "@/hooks/useCorrectChain";
import {
  getAppRuntime,
  isMiniPayRuntime,
  runtimeToPlatform,
  type AppRuntime,
} from "@/lib/client/runtime";
import { MINIPAY_PAYMENT_TOKEN_SYMBOL } from "@/lib/minipay/compliance";

// Animated Wallet Icon with coin drop effect
function AnimatedWalletIcon({ triggerAnim }: { triggerAnim: boolean }) {
  return (
    <svg
      width={12}
      height={11}
      viewBox="0 0 16 16"
      fill="none"
      className="mr-1"
    >
      {/* Wallet body */}
      <path
        d="M2 6.2H13.4C13.559 6.2 13.712 6.263 13.824 6.376C13.937 6.488 14 6.641 14 6.8V12.8C14 12.959 13.937 13.112 13.824 13.224C13.712 13.337 13.559 13.4 13.4 13.4H2.6C2.441 13.4 2.288 13.337 2.176 13.224C2.063 13.112 2 12.959 2 12.8V6.2Z"
        fill="currentColor"
        className={triggerAnim ? "origin-bottom animate-[wallet-pop_300ms_ease-out]" : ""}
      />
      {/* Wallet flap */}
      <path
        d="M2.6 2.6H11.6V5H2V3.2C2 3.041 2.063 2.888 2.176 2.776C2.288 2.663 2.441 2.6 2.6 2.6Z"
        fill="currentColor"
        className={triggerAnim ? "origin-left animate-[wallet-flap_250ms_ease-out]" : ""}
      />
      {/* Coin slot - pulses */}
      <rect
        x="9.8"
        y="9.2"
        width="1.8"
        height="1.2"
        rx="0.2"
        fill="currentColor"
        className={triggerAnim ? "origin-center animate-[wallet-slot_400ms_ease-out_100ms]" : ""}
      />
    </svg>
  );
}

export function WalletBalance() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [runtime, setRuntime] = useState<AppRuntime>("browser");
  const platform =
    runtime === "minipay" || isMiniPayRuntime()
      ? "MINIPAY"
      : runtimeToPlatform(runtime);
  const { ensureCorrectChain, isOnCorrectChain } = useCorrectChain(platform);

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

  // Auto-connect with the injected wallet when available
  useEffect(() => {
    if (runtime !== "farcaster" && !isConnected && connectors.length > 0) {
      connect({
        connector: connectors.find((item) => item.id === "injected") || connectors[0],
      });
    }
  }, [runtime, isConnected, connect, connectors]);

  // Auto-switch to correct chain when wallet is connected
  useEffect(() => {
    if (isConnected && !isOnCorrectChain) {
      ensureCorrectChain().catch((err) => {
        console.error("Failed to auto-switch chain:", err);
      });
    }
  }, [isConnected, isOnCorrectChain, ensureCorrectChain]);

  const tokenAddress = getPaymentTokenAddress(platform);
  const chain = getPlatformChain(platform);

  // Fetch balance using the TARGET chain
  const { roundedBalance, status } = useGetTokenBalance(address as `0x${string}`, {
    address: tokenAddress as `0x${string}`,
    decimals: PAYMENT_TOKEN_DECIMALS,
    name: platform === "MINIPAY" ? MINIPAY_PAYMENT_TOKEN_SYMBOL : "USDC",
    symbol: platform === "MINIPAY" ? MINIPAY_PAYMENT_TOKEN_SYMBOL : "USDC",
    image: "/images/icons/icon-prizepool-cash.webp",
    chainId: chain.id,
  });

  // Track previous balance for animation trigger
  const prevBalance = useRef(roundedBalance);
  const [displayBalance, setDisplayBalance] = useState<string>("");
  const [isBalanceAnimating, setIsBalanceAnimating] = useState(false);

  // Animate on balance change
  useEffect(() => {
    if (status === "success" && roundedBalance !== undefined && roundedBalance !== "") {
      setDisplayBalance(roundedBalance);
    }

    if (prevBalance.current !== roundedBalance && roundedBalance !== undefined && roundedBalance !== "") {
      setIsBalanceAnimating(true);
      window.setTimeout(() => setIsBalanceAnimating(false), 300);
      prevBalance.current = roundedBalance;
    }
  }, [roundedBalance, status]);

  const balanceLabel =
    displayBalance !== ""
      ? `$${Number(displayBalance).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "..."

  return (
    <div
      className="flex items-center px-3 py-1.5 rounded-full bg-[#F9F9F91A] font-body cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:scale-105 hover:bg-white/15 active:scale-95"
    >
      <AnimatedWalletIcon triggerAnim={false} />
      <span
        className={cn(
          "text-center font-normal not-italic text-[16px] leading-[100%] tracking-[0px] text-white",
          isBalanceAnimating && "animate-[balance-pop_300ms_ease-out]",
        )}
      >
        {balanceLabel}
      </span>
    </div>
  );
}
