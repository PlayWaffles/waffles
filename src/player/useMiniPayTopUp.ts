"use client";

import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useTokenBalance } from "@/hooks/waffleContractHooks";
import { getPaymentTokenAddress, PAYMENT_TOKEN_DECIMALS } from "@/lib/chain";
import { isMiniPayRuntime } from "@/lib/client/runtime";
import { MINIPAY_DEPOSIT_URL } from "@/lib/minipay/compliance";

const MINIPAY = "MINIPAY" as const;

/**
 * MiniPay funding helper for the tournament entry flow. Reads the user's
 * payment-token (USDT) balance and, when it's below the entry fee, exposes a
 * one-tap "Add Cash" deeplink into MiniPay's on-ramp — so users who accept an
 * entry but can't afford it get a top-up path instead of a dead-end error
 * (the single biggest leak in the accept→pay funnel). No-op outside MiniPay.
 */
export function useMiniPayTopUp(entryFee: number | null | undefined) {
  const isMiniPay = isMiniPayRuntime();
  const { address } = useAccount();
  const token = getPaymentTokenAddress(MINIPAY);
  // Only query the balance inside MiniPay (the deeplink only applies there).
  const { data: balance } = useTokenBalance(isMiniPay ? address : undefined, token, MINIPAY);

  const required =
    entryFee != null && entryFee > 0 ? parseUnits(entryFee.toString(), PAYMENT_TOKEN_DECIMALS) : null;
  const needsTopUp =
    isMiniPay && typeof balance === "bigint" && required != null && balance < required;

  const openAddCash = () => {
    if (typeof window !== "undefined") window.location.href = MINIPAY_DEPOSIT_URL;
  };

  return { isMiniPay, needsTopUp, openAddCash };
}
