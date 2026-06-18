"use client";

/**
 * Client wallet wiring for on-chain tournaments. Promise-based wrappers around
 * the exact same contract config the v1 player used (`waffleGameAbi`, the
 * payment token, the builder-code data suffix) — so entry (`buyTicket`) and
 * prize `claimPrize` reuse v1's chain layer verbatim, just exposed as awaitable
 * functions the ProtoProvider's async actions can call.
 *
 * Platform is passed per-call (taken from the server-loaded game) rather than at
 * hook time, since the provider doesn't know it until the tournament loads.
 */
import { useCallback } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { waffleGameAbi } from "@/lib/chain/abi";
import { withBuilderCodeDataSuffix } from "@/lib/chain/builderCode";
import {
  PAYMENT_TOKEN_DECIMALS,
  getPaymentTokenAddress,
  getPlatformChain,
  getWaffleContractAddress,
} from "@/lib/chain/config";
import { defaultNetworkForPlatform } from "@/lib/chain/network";
import type { ChainPlatform } from "@/lib/chain/platform";
import { ERC20_ABI } from "@/lib/constants";
import { MINIPAY_LOW_BALANCE_MESSAGE } from "@/lib/minipay/compliance";

// Approve a buffer (not the exact fee) so the allowance covers several entries
// before the player has to approve again — mirrors v1's MAX_TICKET_APPROVAL.
const MAX_ENTRY_APPROVAL_USDC = "10";

/**
 * Progress steps for the on-chain entry/claim flow (mirrors v1's PurchaseStep).
 * The hook reports up to `confirming`; the provider adds `verifying` for its
 * server-side step. Lets the UI narrate the (sometimes two-popup) flow.
 */
export type TournamentTxStep =
  | "switching"
  | "approving"
  | "approveConfirm"
  | "paying"
  | "confirming"
  | "claiming"
  | "verifying";

/** Player-facing label for each step. */
export function txStepLabel(step: TournamentTxStep | null): string {
  switch (step) {
    case "switching": return "Switching network…";
    case "approving": return "Approve in your wallet…";
    case "approveConfirm": return "Confirming approval…";
    case "paying": return "Confirm entry in your wallet…";
    case "confirming": return "Confirming on-chain…";
    case "claiming": return "Confirm claim in your wallet…";
    case "verifying": return "Finalizing…";
    default: return "Working…";
  }
}

/** Map raw wallet/chain errors to player-facing messages (mirrors v1's
 *  useTicketPurchase handling). */
function walletErrorMessage(error: unknown, platform: ChainPlatform): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/user rejected|denied|rejected the request/i.test(msg)) return "Cancelled.";
  if (/insufficient/i.test(msg)) {
    return platform === "MINIPAY" ? MINIPAY_LOW_BALANCE_MESSAGE : "Not enough balance to enter.";
  }
  return "Something went wrong. Please try again.";
}

export function useTournamentWallet() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  /**
   * Approve (if needed) + `buyTicket`. Resolves with the entry tx hash once it's
   * confirmed, ready to hand to `enterTournament` for on-chain verification.
   */
  const enter = useCallback(
    async (
      platform: ChainPlatform,
      onchainId: `0x${string}`,
      entryFeeUsdc: number,
      onStep?: (step: TournamentTxStep) => void,
    ): Promise<`0x${string}`> => {
      if (!address) throw new Error("Connect a wallet to enter.");
      if (!publicClient) throw new Error("no_public_client");
      const target = { platform, network: defaultNetworkForPlatform(platform) };
      const chainId = getPlatformChain(target).id;
      const contractAddress = getWaffleContractAddress(target);
      const tokenAddress = getPaymentTokenAddress(target);
      const amount = parseUnits(entryFeeUsdc.toString(), PAYMENT_TOKEN_DECIMALS);
      console.log("[buy-ticket] wallet.enter start", {
        platform, chainId, currentChainId, address, contractAddress, tokenAddress,
        onchainId, entryFeeUsdc, amount: amount.toString(),
      });

      try {
        // Make sure the wallet is on the game's chain before any tx (v1 reuse).
        if (currentChainId !== chainId) {
          console.log("[buy-ticket] switching chain", { from: currentChainId, to: chainId });
          onStep?.("switching");
          await switchChainAsync({ chainId });
        }

        const allowance = (await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, contractAddress],
        })) as bigint;
        console.log("[buy-ticket] allowance read", { allowance: allowance.toString(), needed: amount.toString() });

        // Approve only when the standing allowance can't cover this entry; then
        // approve a buffer (≥ a few entries) so it's not a per-entry pop-up.
        if (allowance < amount) {
          onStep?.("approving");
          const approvalAmount = parseUnits(MAX_ENTRY_APPROVAL_USDC, PAYMENT_TOKEN_DECIMALS);
          const approveAmount = approvalAmount > amount ? approvalAmount : amount;
          console.log("[buy-ticket] approving", { approveAmount: approveAmount.toString() });
          const approveHash = await writeContractAsync(
            withBuilderCodeDataSuffix({
              chainId,
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [contractAddress, approveAmount],
            }),
          );
          onStep?.("approveConfirm");
          console.log("[buy-ticket] approve tx sent, waiting", { approveHash });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
          console.log("[buy-ticket] approve confirmed");
        }

        onStep?.("paying");
        console.log("[buy-ticket] sending buyTicket", { onchainId, amount: amount.toString() });
        const buyHash = await writeContractAsync(
          withBuilderCodeDataSuffix({
            chainId,
            address: contractAddress,
            abi: waffleGameAbi,
            functionName: "buyTicket",
            args: [onchainId, amount],
          }),
        );
        onStep?.("confirming");
        console.log("[buy-ticket] buyTicket tx sent, waiting", { buyHash });
        await publicClient.waitForTransactionReceipt({ hash: buyHash });
        console.log("[buy-ticket] buyTicket confirmed ✓", { buyHash });
        return buyHash;
      } catch (error) {
        // Log the RAW error (the friendly message hides the on-chain revert reason).
        console.error("[buy-ticket] wallet.enter FAILED — raw error:", error);
        throw new Error(walletErrorMessage(error, platform));
      }
    },
    [address, publicClient, writeContractAsync, currentChainId, switchChainAsync],
  );

  /**
   * Claim a settled prize from the on-chain pool with the merkle proof produced
   * by `publishResults`. Resolves with the claim tx hash once confirmed.
   */
  const claim = useCallback(
    async (
      platform: ChainPlatform,
      onchainId: `0x${string}`,
      amount: bigint,
      proof: `0x${string}`[],
      onStep?: (step: TournamentTxStep) => void,
    ): Promise<`0x${string}`> => {
      if (!publicClient) throw new Error("no_public_client");
      const target = { platform, network: defaultNetworkForPlatform(platform) };
      const chainId = getPlatformChain(target).id;
      const contractAddress = getWaffleContractAddress(target);
      try {
        if (currentChainId !== chainId) {
          onStep?.("switching");
          await switchChainAsync({ chainId });
        }
        onStep?.("claiming");
        const hash = await writeContractAsync(
          withBuilderCodeDataSuffix({
            chainId,
            address: contractAddress,
            abi: waffleGameAbi,
            functionName: "claimPrize",
            args: [onchainId, amount, proof],
          }),
        );
        onStep?.("confirming");
        await publicClient.waitForTransactionReceipt({ hash });
        return hash;
      } catch (error) {
        throw new Error(walletErrorMessage(error, platform));
      }
    },
    [publicClient, writeContractAsync, currentChainId, switchChainAsync],
  );

  return { address, enter, claim };
}
