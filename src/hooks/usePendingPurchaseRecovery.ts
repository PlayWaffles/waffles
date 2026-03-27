"use client";

import { useEffect, useRef } from "react";
import { purchaseGameTicket } from "@/actions/game";

/**
 * Hook to recover pending purchases that failed to sync.
 *
 * If a user paid on-chain but the backend sync failed,
 * the txHash is saved to localStorage. This hook checks
 * for pending purchases and retries the sync on page load.
 */
export function usePendingPurchaseRecovery(
  gameId: string,
  userId: string | undefined,
  wallet: string | undefined,
  onRecovered?: () => void,
) {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current || !userId || !wallet) return;
    hasChecked.current = true;

    const key = `pending-purchase-${gameId}`;
    const pendingData = localStorage.getItem(key);

    if (!pendingData) return;

    try {
      const pending = JSON.parse(pendingData);

      // Only recover if from within last 24 hours
      if (Date.now() - pending.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return;
      }

      // Verify it's for the same user
      if (pending.userId !== userId) {
        localStorage.removeItem(key);
        return;
      }

      console.log(
        "[Recovery] Found pending purchase, attempting sync:",
        pending,
      );

      // Attempt recovery
      purchaseGameTicket({
        gameId,
        txHash: pending.txHash,
        paidAmount: pending.price,
        payerWallet: pending.wallet,
      })
        .then((result) => {
          if (result.success) {
            console.log("[Recovery] Successfully recovered pending purchase!");
            localStorage.removeItem(key);
            onRecovered?.();
          } else {
            console.log("[Recovery] Recovery failed:", result.error);
            // Keep in localStorage for next attempt
          }
        })
        .catch((err) => {
          console.error("[Recovery] Recovery error:", err);
        });
    } catch {
      localStorage.removeItem(key);
    }
  }, [gameId, userId, wallet, onRecovered]);
}
