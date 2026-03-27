/**
 * On-Chain Payment Verification
 *
 * 3-layer verification to ensure ticket purchases are legitimate:
 * 1. Transaction receipt status check
 * 2. TicketPurchased event parsing and validation
 * 3. Contract state verification (hasTicket)
 */

import { formatUnits } from "viem";
import { getPublicClient } from "./client";
import { waffleGameAbi } from "./abi";
import {
  PAYMENT_TOKEN_DECIMALS,
  getWaffleContractAddress,
} from "./config";
import { type ChainPlatform } from "./platform";

// ============================================================================
// Types
// ============================================================================

export interface VerifyTicketPurchaseResult {
  verified: boolean;
  error?: string;
  details?: {
    gameId: `0x${string}`;
    buyer: `0x${string}`;
    amount: bigint;
    amountFormatted: string;
  };
}

export interface VerifyTicketPurchaseInput {
  platform: ChainPlatform;
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
  const { platform, txHash, expectedGameId, expectedBuyer, minimumAmount } = input;
  const contractAddress = getWaffleContractAddress(platform);
  const publicClient = getPublicClient(platform);

  try {
    // =========================================================================
    // Layer 1: Transaction Receipt Verification
    // =========================================================================

    let receipt;
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: txHash });
    } catch (err) {
      // Transaction not found or pending
      return {
        verified: false,
        error: "Transaction not found. It may still be pending.",
      };
    }

    if (receipt.status !== "success") {
      return {
        verified: false,
        error: "Transaction reverted on-chain. Funds were not transferred.",
      };
    }

    // =========================================================================
    // Layer 2: Event Log Verification
    // =========================================================================

    // Look for TicketPurchased event logs from our contract
    const contractLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === contractAddress.toLowerCase(),
    );

    if (contractLogs.length === 0) {
      return {
        verified: false,
        error: "No events from WaffleGame contract found.",
      };
    }

    // Parse event data manually - TicketPurchased has:
    // topics[0] = event signature
    // topics[1] = gameId (indexed)
    // topics[2] = buyer (indexed)
    // data = amount (not indexed)
    let matchingEvent: {
      gameId: `0x${string}`;
      buyer: `0x${string}`;
      amount: bigint;
    } | null = null;

    for (const log of contractLogs) {
      if (log.topics.length >= 3) {
        // topics[1] is gameId (bytes32, already padded)
        const logGameId = log.topics[1] as `0x${string}`;
        // topics[2] is buyer address (padded to 32 bytes, need to extract last 20 bytes)
        const buyerPadded = log.topics[2] as `0x${string}`;
        const logBuyer = `0x${buyerPadded.slice(-40)}` as `0x${string}`;
        // data is amount (uint256)
        const logAmount = log.data ? BigInt(log.data) : BigInt(0);

        if (
          logGameId.toLowerCase() === expectedGameId.toLowerCase() &&
          logBuyer.toLowerCase() === expectedBuyer.toLowerCase()
        ) {
          matchingEvent = {
            gameId: logGameId,
            buyer: logBuyer,
            amount: logAmount,
          };
          break;
        }
      }
    }

    if (!matchingEvent) {
      return {
        verified: false,
        error: "TicketPurchased event does not match expected game/buyer.",
      };
    }

    // Verify minimum payment amount
    if (matchingEvent.amount < minimumAmount) {
      return {
        verified: false,
        error: `Payment amount (${formatUnits(matchingEvent.amount, PAYMENT_TOKEN_DECIMALS)}) is less than minimum required.`,
      };
    }

    // =========================================================================
    // Layer 3: Contract State Verification (Reorg Protection)
    // =========================================================================

    let hasTicket: boolean;
    try {
      hasTicket = (await publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "hasTicket",
        args: [expectedGameId, expectedBuyer],
      })) as boolean;
    } catch (err) {
      return {
        verified: false,
        error: "Failed to verify ticket on contract. Please try again.",
      };
    }

    if (!hasTicket) {
      return {
        verified: false,
        error:
          "Ticket not recorded on-chain. Possible chain reorganization - please wait and try again.",
      };
    }

    // =========================================================================
    // All 3 Layers Passed - Verified!
    // =========================================================================

    return {
      verified: true,
      details: {
        gameId: matchingEvent.gameId,
        buyer: matchingEvent.buyer,
        amount: matchingEvent.amount,
        amountFormatted: formatUnits(matchingEvent.amount, PAYMENT_TOKEN_DECIMALS),
      },
    };
  } catch (error) {
    console.error("[verifyTicketPurchase] Unexpected error:", error);
    return {
      verified: false,
      error: `Verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
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
  const { platform, txHash, expectedGameId, expectedClaimer } = input;
  const contractAddress = getWaffleContractAddress(platform);
  const publicClient = getPublicClient(platform);

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
