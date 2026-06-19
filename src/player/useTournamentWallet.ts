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
import { logClient } from "@/actions/player";

// Forward the wallet-flow trace to the SERVER terminal (the wallet steps run in
// the browser, so plain console.log would only land in the device console).
// Errors are flattened to a string since Error objects don't cross the RSC wire.
const blog = (msg: string, data?: unknown) => {
  const safe =
    data instanceof Error
      ? `${(data as { shortMessage?: string }).shortMessage ?? data.message}\n${data.stack ?? ""}`.slice(0, 1500)
      : data;
  void logClient(msg, safe);
};

// Approve a buffer (not the exact fee) so the allowance covers several entries
// before the player has to approve again — mirrors v1's MAX_TICKET_APPROVAL.
const MAX_ENTRY_APPROVAL_USDC = "10";
const APPROVE_GAS_LIMIT = BigInt(100_000);
const BUY_TICKET_GAS_LIMIT = BigInt(245_574);
const NETWORK_FEE_BUFFER_USDC = "0.002";

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
  if (/reverted|failed on-chain|transaction failed/i.test(msg)) return "Transaction failed on-chain. Your ticket was not purchased.";
  if (/insufficient|not enough|balance|transfer amount exceeds balance/i.test(msg)) {
    return platform === "MINIPAY" ? MINIPAY_LOW_BALANCE_MESSAGE : "Not enough balance to enter.";
  }
  return "Something went wrong. Please try again.";
}

function tokenUnitsForGas(gasLimit: bigint, gasPrice: bigint) {
  const tokenScale = BigInt(10) ** BigInt(PAYMENT_TOKEN_DECIMALS);
  const nativeScale = BigInt(10) ** BigInt(18);
  return (gasLimit * gasPrice * tokenScale + nativeScale - BigInt(1)) / nativeScale;
}

function assertSuccessfulReceipt(receipt: { status: "success" | "reverted" }, label: string) {
  if (receipt.status !== "success") {
    throw new Error(`${label} transaction failed on-chain`);
  }
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
      blog("[buy-ticket] wallet.enter start", {
        platform, chainId, currentChainId, address, contractAddress, tokenAddress,
        onchainId, entryFeeUsdc, amount: amount.toString(),
      });

      try {
        // Make sure the wallet is on the game's chain before any tx (v1 reuse).
        if (currentChainId !== chainId) {
          blog("[buy-ticket] switching chain", { from: currentChainId, to: chainId });
          onStep?.("switching");
          await switchChainAsync({ chainId });
        }

        const [allowance, balance, gasPrice] = await Promise.all([
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, contractAddress],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          }) as Promise<bigint>,
          publicClient.getGasPrice(),
        ]);
        const needsApproval = allowance < amount;
        const gasLimit = needsApproval
          ? APPROVE_GAS_LIMIT + BUY_TICKET_GAS_LIMIT
          : BUY_TICKET_GAS_LIMIT;
        const estimatedFee = platform === "MINIPAY"
          ? tokenUnitsForGas(gasLimit, gasPrice)
          : BigInt(0);
        const feeBuffer = platform === "MINIPAY"
          ? parseUnits(NETWORK_FEE_BUFFER_USDC, PAYMENT_TOKEN_DECIMALS)
          : BigInt(0);
        const neededBalance = amount + estimatedFee + feeBuffer;
        blog("[buy-ticket] preflight read", {
          allowance: allowance.toString(),
          balance: balance.toString(),
          neededAllowance: amount.toString(),
          neededBalance: neededBalance.toString(),
          needsApproval,
          gasLimit: gasLimit.toString(),
          estimatedFee: estimatedFee.toString(),
          feeBuffer: feeBuffer.toString(),
        });

        if (balance < neededBalance) {
          throw new Error(platform === "MINIPAY" ? MINIPAY_LOW_BALANCE_MESSAGE : "Not enough balance to enter.");
        }

        // Approve only when the standing allowance can't cover this entry; then
        // approve a buffer (≥ a few entries) so it's not a per-entry pop-up.
        if (needsApproval) {
          onStep?.("approving");
          const approvalAmount = parseUnits(MAX_ENTRY_APPROVAL_USDC, PAYMENT_TOKEN_DECIMALS);
          const approveAmount = approvalAmount > amount ? approvalAmount : amount;
          blog("[buy-ticket] approving", { approveAmount: approveAmount.toString() });
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
          blog("[buy-ticket] approve tx sent, waiting", { approveHash });
          const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
          assertSuccessfulReceipt(approveReceipt, "Approval");
          blog("[buy-ticket] approve confirmed");
        }

        onStep?.("paying");
        blog("[buy-ticket] sending buyTicket", { onchainId, amount: amount.toString() });
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
        blog("[buy-ticket] buyTicket tx sent, waiting", { buyHash });
        const buyReceipt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
        assertSuccessfulReceipt(buyReceipt, "Ticket purchase");
        blog("[buy-ticket] buyTicket confirmed ✓", { buyHash });
        return buyHash;
      } catch (error) {
        // Log the RAW error (the friendly message hides the on-chain revert reason).
        blog("[buy-ticket] wallet.enter FAILED — raw error:", error);
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
