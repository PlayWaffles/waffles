/**
 * On-Chain Payment Verification
 *
 * 3-layer verification to ensure ticket purchases are legitimate:
 * 1. Transaction receipt status check
 * 2. TicketPurchased event parsing and validation
 * 3. Contract state verification (hasTicket)
 */

import { decodeEventLog, formatUnits } from "viem";
import { getPublicClient } from "./client";
import { waffleGameAbi } from "./abi";
import {
  PAYMENT_TOKEN_DECIMALS,
  getWaffleContractAddress,
} from "./config";
import { type ChainPlatform } from "./platform";
import type { GameNetwork } from "./network";

// ============================================================================
// Types
// ============================================================================

export interface VerifyTicketPurchaseResult {
  verified: boolean;
  error?: string;
  details?: TicketPurchaseDetails;
}

export interface TicketPurchaseDetails {
  gameId: `0x${string}`;
  buyer: `0x${string}`;
  amount: bigint;
  amountFormatted: string;
}

export interface InspectTicketPurchaseResult {
  found: boolean;
  error?: string;
  details?: TicketPurchaseDetails;
}

export interface VerifyTicketPurchaseInput {
  platform: ChainPlatform;
  network?: GameNetwork | null;
  txHash: `0x${string}`;
  expectedGameId: `0x${string}`;
  expectedBuyer: `0x${string}`;
  minimumAmount: bigint;
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Verify a ticket purchase transaction on-chain.
 *
 * Performs 3-layer verification:
 * 1. Transaction receipt - ensures tx succeeded
 * 2. Event logs - ensures TicketPurchased was emitted with correct params
 * 3. Contract state - ensures hasTicket() returns true (reorg protection)
 */
export async function verifyTicketPurchase(
  input: VerifyTicketPurchaseInput,
): Promise<VerifyTicketPurchaseResult> {
  const {
    platform,
    network,
    txHash,
    expectedGameId,
    expectedBuyer,
    minimumAmount,
  } = input;
  const chainTarget = { platform, network };
  const contractAddress = getWaffleContractAddress(chainTarget);
  const publicClient = getPublicClient(chainTarget);

  console.log("[verify-ticket-purchase]", {
    stage: "start",
    platform,
    txHash,
    expectedGameId,
    expectedBuyer,
    minimumAmount: minimumAmount.toString(),
    contractAddress,
  });

  try {
    const inspected = await inspectTicketPurchase({ platform, network, txHash });
    if (!inspected.found || !inspected.details) {
      return {
        verified: false,
        error: inspected.error || "TicketPurchased event not found.",
      };
    }

    if (
      inspected.details.gameId.toLowerCase() !== expectedGameId.toLowerCase() ||
      inspected.details.buyer.toLowerCase() !== expectedBuyer.toLowerCase()
    ) {
      console.error("[verify-ticket-purchase]", {
        stage: "no-matching-event",
        platform,
        txHash,
        expectedGameId,
        expectedBuyer,
        actualGameId: inspected.details.gameId,
        actualBuyer: inspected.details.buyer,
      });
      return {
        verified: false,
        error: "TicketPurchased event does not match expected game/buyer.",
      };
    }

    // Verify minimum payment amount
    if (inspected.details.amount < minimumAmount) {
      console.error("[verify-ticket-purchase]", {
        stage: "amount-too-low",
        platform,
        txHash,
        matchingAmount: inspected.details.amount.toString(),
        minimumAmount: minimumAmount.toString(),
      });
      return {
        verified: false,
        error: `Payment amount (${formatUnits(inspected.details.amount, PAYMENT_TOKEN_DECIMALS)}) is less than minimum required.`,
      };
    }

    // =========================================================================
    // All 3 Layers Passed - Verified!
    // =========================================================================

    return {
      verified: true,
      details: inspected.details,
    };
  } catch (error) {
    console.error("[verify-ticket-purchase]", {
      stage: "unexpected-error",
      platform,
      txHash,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      verified: false,
      error: `Verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export async function inspectTicketPurchase(input: {
  platform: ChainPlatform;
  network?: GameNetwork | null;
  txHash: `0x${string}`;
}): Promise<InspectTicketPurchaseResult> {
  const { platform, network, txHash } = input;
  const chainTarget = { platform, network };
  const contractAddress = getWaffleContractAddress(chainTarget);
  const publicClient = getPublicClient(chainTarget);

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return {
      found: false,
      error: "Transaction not found on this platform. It may still be pending.",
    };
  }

  if (receipt.status !== "success") {
    console.error("[inspect-ticket-purchase]", {
      stage: "receipt-failed",
      platform,
      txHash,
      receiptStatus: receipt.status,
    });
    return {
      found: false,
      error: "Transaction reverted on-chain. Funds were not transferred.",
    };
  }

  const contractLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === contractAddress.toLowerCase(),
  );

  if (contractLogs.length === 0) {
    return {
      found: false,
      error: "No events from the WaffleGame contract were found for this transaction.",
    };
  }

  let purchase: TicketPurchaseDetails | null = null;

  for (const log of contractLogs) {
    try {
      const decoded = decodeEventLog({
        abi: waffleGameAbi,
        data: log.data,
        topics: log.topics,
        eventName: "TicketPurchased",
      });

      if (!decoded.args) continue;
      const args = decoded.args as unknown as {
        gameId: `0x${string}`;
        buyer: `0x${string}`;
        amount: bigint;
      };

      purchase = {
        gameId: args.gameId,
        buyer: args.buyer,
        amount: args.amount,
        amountFormatted: formatUnits(args.amount, PAYMENT_TOKEN_DECIMALS),
      };
      break;
    } catch {
      continue;
    }
  }

  if (!purchase) {
    return {
      found: false,
      error: "TicketPurchased event not found for this transaction.",
    };
  }

  try {
    const hasTicket = (await publicClient.readContract({
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "hasTicket",
      args: [purchase.gameId, purchase.buyer],
    })) as boolean;

    if (!hasTicket) {
      return {
        found: false,
        error:
          "TicketPurchased was emitted, but the ticket is not currently recorded on-chain.",
      };
    }
  } catch (err) {
    console.error("[inspect-ticket-purchase]", {
      stage: "has-ticket-read-failed",
      platform,
      txHash,
      gameId: purchase.gameId,
      buyer: purchase.buyer,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return {
      found: false,
      error: "Failed to confirm ticket ownership on-chain.",
    };
  }

  return {
    found: true,
    details: purchase,
  };
}

// ============================================================================
// Helper: Wait for Transaction Confirmation
// ============================================================================

/**
 * Wait for a transaction to be confirmed and return the receipt.
 * Useful for ensuring finality before verification.
 */
export async function waitForTransaction(
  platform: ChainPlatform,
  txHash: `0x${string}`,
  confirmations: number = 1,
): Promise<{
  success: boolean;
  receipt?: Awaited<ReturnType<ReturnType<typeof getPublicClient>["getTransactionReceipt"]>>;
}> {
  try {
    const publicClient = getPublicClient(platform);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations,
    });
    return { success: receipt.status === "success", receipt };
  } catch (error) {
    console.error("[waitForTransaction] Error:", error);
    return { success: false };
  }
}

// ============================================================================
// Claim Verification
// ============================================================================

export interface VerifyClaimResult {
  verified: boolean;
  error?: string;
  details?: {
    gameId: `0x${string}`;
    claimer: `0x${string}`;
    amount: bigint;
    amountFormatted: string;
  };
}

export interface VerifyClaimInput {
  platform: ChainPlatform;
  network?: GameNetwork | null;
  txHash: `0x${string}`;
  expectedGameId: `0x${string}`;
  expectedClaimer: `0x${string}`;
}

/**
 * Verify a prize claim transaction on-chain.
 *
 * Performs 3-layer verification:
 * 1. Transaction receipt - ensures tx succeeded
 * 2. Event logs - ensures PrizeClaimed was emitted with correct params
 * 3. Contract state - ensures hasClaimed() returns true (reorg protection)
 */
export async function verifyClaim(
  input: VerifyClaimInput,
): Promise<VerifyClaimResult> {
  const { platform, network, txHash, expectedGameId, expectedClaimer } = input;
  const chainTarget = { platform, network };
  const contractAddress = getWaffleContractAddress(chainTarget);
  const publicClient = getPublicClient(chainTarget);

  try {
    // =========================================================================
    // Layer 1: Transaction Receipt Verification
    // =========================================================================

    let receipt;
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    } catch {
      return {
        verified: false,
        error: "Transaction not found. It may still be pending.",
      };
    }

    if (receipt.status !== "success") {
      return {
        verified: false,
        error: "Transaction reverted on-chain.",
      };
    }

    // =========================================================================
    // Layer 2: Event Log Verification
    // =========================================================================

    // Look for logs from our contract
    const contractLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === contractAddress.toLowerCase(),
    );

    if (contractLogs.length === 0) {
      return {
        verified: false,
        error: "No events from WaffleGame contract found.",
      };
    }

    // Parse PrizeClaimed event - has:
    // topics[0] = event signature
    // topics[1] = gameId (indexed)
    // topics[2] = claimer (indexed)
    // data = amount (not indexed)
    let matchingEvent: {
      gameId: `0x${string}`;
      claimer: `0x${string}`;
      amount: bigint;
    } | null = null;

    for (const log of contractLogs) {
      if (log.topics.length >= 3) {
        const logGameId = log.topics[1] as `0x${string}`;
        const claimerPadded = log.topics[2] as `0x${string}`;
        const logClaimer = `0x${claimerPadded.slice(-40)}` as `0x${string}`;
        const logAmount = log.data ? BigInt(log.data) : BigInt(0);

        if (
          logGameId.toLowerCase() === expectedGameId.toLowerCase() &&
          logClaimer.toLowerCase() === expectedClaimer.toLowerCase()
        ) {
          matchingEvent = {
            gameId: logGameId,
            claimer: logClaimer,
            amount: logAmount,
          };
          break;
        }
      }
    }

    if (!matchingEvent) {
      return {
        verified: false,
        error: "PrizeClaimed event does not match expected game/claimer.",
      };
    }

    // =========================================================================
    // Layer 3: Contract State Verification (Reorg Protection)
    // =========================================================================

    let hasClaimed: boolean;
    try {
      hasClaimed = (await publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "hasClaimed",
        args: [expectedGameId, expectedClaimer],
      })) as boolean;
    } catch {
      return {
        verified: false,
        error: "Failed to verify claim on contract. Please try again.",
      };
    }

    if (!hasClaimed) {
      return {
        verified: false,
        error:
          "Claim not recorded on-chain. Possible chain reorganization - please wait and try again.",
      };
    }

    // =========================================================================
    // All 3 Layers Passed - Verified!
    // =========================================================================

    return {
      verified: true,
      details: {
        gameId: matchingEvent.gameId,
        claimer: matchingEvent.claimer,
        amount: matchingEvent.amount,
        amountFormatted: formatUnits(
          matchingEvent.amount,
          PAYMENT_TOKEN_DECIMALS,
        ),
      },
    };
  } catch (error) {
    console.error("[verifyClaim] Unexpected error:", error);
    return {
      verified: false,
      error: `Verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
