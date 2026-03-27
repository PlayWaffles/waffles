"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSendCalls, useCallsStatus } from "wagmi";
import { parseUnits, encodeFunctionData } from "viem";

import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useTokenAllowance } from "./waffleContractHooks";
import { notify } from "@/components/ui/Toaster";
import { playSound } from "@/lib/sounds";
import { waffleGameAbi } from "@/lib/chain/abi";
import { ERC20_ABI } from "@/lib/constants";
import { purchaseGameTicket } from "@/actions/game";
import {
  PAYMENT_TOKEN_DECIMALS,
  getPaymentTokenAddress,
  getWaffleContractAddress,
} from "@/lib/chain";
import { builderCodeSendCallsCapability } from "@/lib/chain/builderCode";
import { useCorrectChain } from "./useCorrectChain";
import { useUser } from "./useUser";
import type { ChainPlatform } from "@/lib/chain/platform";

// ==========================================
// TYPES
// ==========================================

export type PurchaseStep =
  | "idle"
  | "connecting"
  | "pending"
  | "confirming"
  | "syncing"
  | "success"
  | "error";

export interface TicketPurchaseState {
  step: PurchaseStep;
  error?: string;
  txHash?: string;
}

// ==========================================
// HOOK: useTicketPurchase
// ==========================================

export function useTicketPurchase(
  gameId: string,
  platform: ChainPlatform,
  onchainId: `0x${string}` | null,
  price: number,
  onSuccess?: () => void,
) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { ensureCorrectChain } = useCorrectChain(platform);
  const { user } = useUser();
  const [state, setState] = useState<TicketPurchaseState>({ step: "idle" });

  // ==========================================
  // BACKEND ENTRY (Source of Truth)
  // ==========================================
  const { state: realtimeState, refetchEntry } = useRealtime();
  const { entry, isLoadingEntry } = realtimeState;

  // Has ticket = entry exists and is paid
  const hasTicket = !!entry?.hasTicket;

  // ==========================================
  // TOKEN & ALLOWANCE
  // ==========================================
  const priceInUnits = useMemo(
    () => parseUnits(price.toString(), PAYMENT_TOKEN_DECIMALS),
    [price],
  );

  const tokenAddress = getPaymentTokenAddress(platform);
  const contractAddress = getWaffleContractAddress(platform);
  const { data: allowance } = useTokenAllowance(
    address as `0x${string}`,
    tokenAddress,
    platform,
  );

  const needsApproval = useMemo(() => {
    if (!allowance) return true;
    return (allowance as bigint) < priceInUnits;
  }, [allowance, priceInUnits]);

  // ==========================================
  // BUILD TRANSACTION CALLS
  // ==========================================
  const calls = useMemo(() => {
    if (!tokenAddress || !onchainId) {
      return [];
    }

    const callList: Array<{ to: `0x${string}`; data: `0x${string}` }> = [];

    if (needsApproval) {
      callList.push({
        to: tokenAddress,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [contractAddress, parseUnits("5000", PAYMENT_TOKEN_DECIMALS)],
        }),
      });
    }

    callList.push({
      to: contractAddress,
      data: encodeFunctionData({
        abi: waffleGameAbi,
        functionName: "buyTicket",
        args: [onchainId, priceInUnits],
      }),
    });

    return callList;
  }, [contractAddress, onchainId, priceInUnits, needsApproval, tokenAddress]);

  // ==========================================
  // WAGMI SEND CALLS
  // ==========================================
  const {
    sendCalls,
    data: callsId,
    isPending: isSending,
    error: sendError,
    reset: resetSendCalls,
  } = useSendCalls();

  const { data: callsStatus } = useCallsStatus({
    id: callsId?.id ?? "",
    query: {
      enabled: !!callsId?.id,
      refetchInterval: (data) =>
        data.state.data?.status === "success" ? false : 1000,
    },
  });

  // ==========================================
  // SYNC WITH BACKEND (with retries)
  // ==========================================
  const syncWithBackend = useCallback(
    async (txHash: string) => {
      if (!address || !user?.id) return;

      const MAX_RETRIES = 5;
      let lastError: string = "Sync failed";

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const result = await purchaseGameTicket({
            gameId,
            txHash,
            paidAmount: price,
            payerWallet: address,
          });

          if (result.success) {
            // Success! Clear any pending recovery data
            localStorage.removeItem(`pending-purchase-${gameId}`);
            setState({ step: "success", txHash });
            playSound("purchase");
            notify.success("Ticket purchased! 🎉");
            refetchEntry();
            router.refresh();
            onSuccess?.();
            return;
          }

          // Verification failure - don't retry, show error
          if (result.code === "VERIFICATION_FAILED") {
            notify.error(result.error || "Payment verification failed");
            setState({ step: "error", error: result.error });
            return;
          }

          lastError = result.error || "Sync failed";
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Sync failed";
        }

        // Wait before retry (exponential backoff: 1s, 2s, 4s, 8s, 16s)
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }

      // All retries failed — save for recovery on next page load
      localStorage.setItem(
        `pending-purchase-${gameId}`,
        JSON.stringify({
          txHash,
          userId: user.id,
          wallet: address,
          price,
          timestamp: Date.now(),
        }),
      );

      notify.error("Sync failed. Your purchase will be verified shortly.");
      setState({ step: "error", error: lastError, txHash });
    },
    [address, user?.id, gameId, price, refetchEntry, router, onSuccess],
  );

  // ==========================================
  // EFFECTS
  // ==========================================
  useEffect(() => {
    if (isSending && state.step !== "pending") {
      setState({ step: "pending" });
    }
  }, [isSending, state.step]);

  useEffect(() => {
    if (sendError) {
      const msg = sendError.message.includes("rejected")
        ? "Transaction rejected"
        : sendError.message.includes("insufficient")
          ? "Insufficient funds"
          : "Transaction failed";
      setState({ step: "error", error: msg });
      notify.error(msg);
    }
  }, [sendError]);

  useEffect(() => {
    if (!callsStatus) return;

    if (callsStatus.status === "pending" && state.step === "pending") {
      setState({ step: "confirming" });
    }

    if (callsStatus.status === "failure") {
      setState({ step: "error", error: "Transaction failed on-chain" });
      notify.error("Transaction failed. Check your balance.");
    }

    if (callsStatus.status === "success") {
      const txHash =
        callsStatus.receipts?.[callsStatus.receipts.length - 1]
          ?.transactionHash;
      setState({ step: "syncing", txHash });
      if (txHash) {
        syncWithBackend(txHash);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callsStatus]);

  // ==========================================
  // PURCHASE ACTION
  // ==========================================
  const purchase = useCallback(async () => {
    if (!onchainId) {
      notify.error("Game not available");
      return;
    }

    if (hasTicket) {
      notify.error("You already have a ticket");
      return;
    }

    // Wallet connection is handled by OnchainKit's autoConnect
    if (!isConnected || !address) {
      notify.info("Wallet connecting... Please wait.");
      return;
    }

    if (calls.length === 0) {
      notify.error("Not ready. Please wait...");
      return;
    }

    resetSendCalls();
    setState({ step: "pending" });

    try {
      await ensureCorrectChain();

      sendCalls({
        calls,
        capabilities: builderCodeSendCallsCapability
          ? {
              atomicBatch: { supported: true },
              ...builderCodeSendCallsCapability,
            }
          : { atomicBatch: { supported: true } },
      });
    } catch (err) {
      setState({ step: "error", error: "Transaction failed" });
      notify.error("Transaction failed");
    }
  }, [
    address,
    isConnected,
    onchainId,
    hasTicket,
    calls,
    sendCalls,
    ensureCorrectChain,
    resetSendCalls,
  ]);

  const reset = useCallback(() => {
    resetSendCalls();
    setState({ step: "idle" });
  }, [resetSendCalls]);

  // ==========================================
  // RETURN
  // ==========================================
  return {
    state,
    step: state.step,
    error: state.error,
    txHash: state.txHash,

    isIdle: state.step === "idle",
    isConnecting: state.step === "connecting",
    isPending: state.step === "pending",
    isConfirming: state.step === "confirming",
    isSyncing: state.step === "syncing",
    isSuccess: state.step === "success",
    isError: state.step === "error",
    isLoading: ["connecting", "pending", "confirming", "syncing"].includes(
      state.step,
    ),

    hasTicket,
    isLoadingEntry,
    needsApproval,
    entry,

    purchase,
    reset,
    refetchEntry,
  };
}

// ==========================================
// BUTTON TEXT HELPER
// ==========================================
export function getPurchaseButtonText(
  step: PurchaseStep,
  price: number,
): string {
  const texts: Record<PurchaseStep, string> = {
    idle: `BUY WAFFLE - $${price}`,
    connecting: "CONNECTING...",
    pending: "CONFIRM IN WALLET...",
    confirming: "CONFIRMING...",
    syncing: "FINALIZING...",
    success: "PURCHASED! ✓",
    error: "TRY AGAIN",
  };
  return texts[step] ?? `BUY WAFFLE - $${price}`;
}
