import { useCallback } from "react";
import { useSwitchChain, useChainId } from "wagmi";
import { getPlatformChain } from "@/lib/chain";
import type { ChainTarget } from "@/lib/chain/network";

/**
 * Hook to ensure the wallet is on the correct chain before performing actions.
 *
 * Ensures the wallet is on the correct platform chain before wallet actions.
 *
 * Usage:
 * ```ts
 * const { ensureCorrectChain, isOnCorrectChain } = useCorrectChain();
 *
 * const handleAction = async () => {
 *   await ensureCorrectChain();
 *   // Now safe to perform action
 * };
 * ```
 */
export function useCorrectChain(target: ChainTarget = "FARCASTER") {
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const chain = getPlatformChain(target);

  const isOnCorrectChain = currentChainId === chain.id;

  const ensureCorrectChain = useCallback(async () => {
    // Only switch if we're on wrong chain
    if (currentChainId !== chain.id) {
      console.log(
        `[Chain] Switching from ${currentChainId} to ${chain.id} (${chain.name})`,
      );
      await switchChainAsync({ chainId: chain.id });
    }
  }, [chain.id, chain.name, currentChainId, switchChainAsync]);

  return {
    ensureCorrectChain,
    isOnCorrectChain,
    currentChainId,
    targetChainId: chain.id,
  };
}
