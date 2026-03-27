"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { parseUnits, encodeFunctionData } from "viem";

import { useRealtime } from "@/components/providers/RealtimeProvider";
import { useTokenAllowance } from "./waffleContractHooks";
import { notify } from "@/components/ui/Toaster";
import { playSound } from "@/lib/sounds";
import { waffleGameAbi } from "@/lib/chain/abi";
import { ERC20_ABI } from "@/lib/constants";
import {
  PAYMENT_TOKEN_DECIMALS,
  getPaymentTokenAddress,
  getWaffleContractAddress,
} from "@/lib/chain";
import { useCorrectChain } from "./useCorrectChain";
import { useUser } from "./useUser";
import type { ChainPlatform } from "@/lib/chain/platform";
import { wagmiConfig } from "@/lib/wagmi/config";
import { authenticatedFetch } from "@/lib/client/runtime";

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

  const { writeContractAsync } = useWriteContract();

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
          console.log("[ticket-purchase]", {
            stage: "sync-start",
            platform,
            gameId,
            txHash,
            paidAmount: price,
            payerWallet: address,
            userId: user.id,
            attempt: attempt + 1,
          });

          const response = await authenticatedFetch(`/api/v1/games/${gameId}/purchase`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              txHash,
              paidAmount: price,
              payerWallet: address,
            }),
          });

          const result = (await response.json()) as
            | { success: true; entryId: string }
            | { success: false; error: string; code?: string };

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
          console.error("[ticket-purchase]", {
            stage: "sync-result-error",
            platform,
            gameId,
            txHash,
            code: result.code,
            error: result.error,
            attempt: attempt + 1,
          });
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Sync failed";
          console.error("[ticket-purchase]", {
            stage: "sync-exception",
            platform,
            gameId,
            txHash,
            error: lastError,
            attempt: attempt + 1,
          });
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

    setState({ step: "pending" });

    try {
      await ensureCorrectChain();

      console.log("[ticket-purchase]", {
        stage: "before-send",
        platform,
        gameId,
        onchainId,
        address,
        tokenAddress,
        contractAddress,
        price,
        priceInUnits: priceInUnits.toString(),
        allowance: typeof allowance === "bigint" ? allowance.toString() : null,
        needsApproval,
      });

      if (needsApproval) {
        const approvalHash = await writeContractAsync({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [contractAddress, parseUnits("5000", PAYMENT_TOKEN_DECIMALS)],
        });

        console.log("[ticket-purchase]", {
          stage: "approval-submitted",
          platform,
          gameId,
          onchainId,
          address,
          txHash: approvalHash,
        });

        setState({ step: "confirming", txHash: approvalHash });

        await waitForTransactionReceipt(wagmiConfig, {
          hash: approvalHash,
          confirmations: 1,
        });

        console.log("[ticket-purchase]", {
          stage: "approval-confirmed",
          platform,
          gameId,
          onchainId,
          address,
          txHash: approvalHash,
        });
      }

      const purchaseHash = await writeContractAsync({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "buyTicket",
        args: [onchainId, priceInUnits],
      });

      console.log("[ticket-purchase]", {
        stage: "purchase-submitted",
        platform,
        gameId,
        onchainId,
        address,
        txHash: purchaseHash,
      });

      setState({ step: "confirming", txHash: purchaseHash });

      await waitForTransactionReceipt(wagmiConfig, {
        hash: purchaseHash,
        confirmations: 1,
      });

      setState({ step: "syncing", txHash: purchaseHash });
      await syncWithBackend(purchaseHash);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      console.error("[ticket-purchase]", {
        stage: "purchase-exception",
        platform,
        gameId,
        onchainId,
        address,
        error: message,
      });

      const msg = message.includes("rejected")
        ? "Transaction rejected"
        : message.includes("insufficient")
          ? "Insufficient funds"
          : "Transaction failed";

      setState({ step: "error", error: msg });
      notify.error(msg);
    }
  }, [
    allowance,
    address,
    isConnected,
    onchainId,
    hasTicket,
    contractAddress,
    ensureCorrectChain,
    gameId,
    needsApproval,
    platform,
    price,
    priceInUnits,
    syncWithBackend,
    tokenAddress,
    writeContractAsync,
  ]);

  const reset = useCallback(() => {
    setState({ step: "idle" });
  }, []);

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
