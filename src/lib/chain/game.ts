/**
 * Game On-Chain Operations
 * Functions for creating, ending, and querying games on-chain
 * Updated for WaffleGame v5
 */

import { parseUnits } from "viem";

import { publicClient, getOperatorWalletClient } from "./client";
import { waffleGameAbi } from "./abi";
import { withBuilderCodeDataSuffix } from "./builderCode";
import { PAYMENT_TOKEN_DECIMALS, WAFFLE_CONTRACT_ADDRESS } from "./config";

// ============================================================================
// Types (v5 Contract)
// ============================================================================

export interface OnChainGame {
  minimumTicketPrice: bigint;
  ticketCount: bigint;
  ticketRevenue: bigint;
  sponsoredAmount: bigint;
  resultsRoot: `0x${string}`;
  settledAt: bigint;
  claimCount: bigint;
  salesClosed: boolean;
}

// ============================================================================
// Game Lifecycle
// ============================================================================

/**
 * Generate a random bytes32 game ID for on-chain use
 */
export function generateOnchainGameId(): `0x${string}` {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

/**
 * Create a game on-chain
 * @param onchainId - The bytes32 on-chain game ID
 * @param minTicketPriceUSDC - Minimum ticket price in USDC (human readable)
 * @returns Transaction hash
 */
export async function createGameOnChain(
  onchainId: `0x${string}`,
  minTicketPriceUSDC: number,
): Promise<`0x${string}`> {
  const walletClient = getOperatorWalletClient();
  const minimumTicketPrice = parseUnits(
    minTicketPriceUSDC.toString(),
    PAYMENT_TOKEN_DECIMALS,
  );

  const hash = await walletClient.writeContract(
    withBuilderCodeDataSuffix({
      address: WAFFLE_CONTRACT_ADDRESS,
      abi: waffleGameAbi,
      functionName: "createGame",
      args: [onchainId, minimumTicketPrice],
    }),
  );

  console.log(`[Chain] Created game ${onchainId}. TX: ${hash}`);
  return hash;
}

/**
 * Close sales for a game on-chain (stops ticket purchases)
 * @param onchainId - The bytes32 on-chain game ID
 * @returns Transaction hash
 */
export async function closeSalesOnChain(
  onchainId: `0x${string}`,
): Promise<`0x${string}`> {
  const walletClient = getOperatorWalletClient();

  const hash = await walletClient.writeContract(
    withBuilderCodeDataSuffix({
      address: WAFFLE_CONTRACT_ADDRESS,
      abi: waffleGameAbi,
      functionName: "closeSales",
      args: [onchainId],
    }),
  );

  console.log(`[Chain] Closed sales for game ${onchainId}. TX: ${hash}`);
  return hash;
}

// ============================================================================
// View Functions
// ============================================================================

/**
 * Get game data from chain
 * @returns null if game doesn't exist on-chain
 */
export async function getOnChainGame(
  onchainId: `0x${string}`,
): Promise<OnChainGame | null> {
  try {
    const game = (await publicClient.readContract({
      address: WAFFLE_CONTRACT_ADDRESS,
      abi: waffleGameAbi,
      functionName: "getGame",
      args: [onchainId],
    })) as OnChainGame;

    // Game doesn't exist if minimumTicketPrice is 0
    if (game.minimumTicketPrice === BigInt(0)) {
      return null;
    }

    return game;
  } catch (error) {
    console.log(`[Chain] Game ${onchainId} not found on-chain`);
    return null;
  }
}

/**
 * Check if a player has a ticket on-chain
 */
export async function hasTicketOnChain(
  onchainId: `0x${string}`,
  playerAddress: `0x${string}`,
): Promise<boolean> {
  const hasTicket = await publicClient.readContract({
    address: WAFFLE_CONTRACT_ADDRESS,
    abi: waffleGameAbi,
    functionName: "hasTicket",
    args: [onchainId, playerAddress],
  });

  return hasTicket as boolean;
}

/**
 * Check if a player has claimed their prize on-chain
 */
export async function hasClaimedOnChain(
  onchainId: `0x${string}`,
  playerAddress: `0x${string}`,
): Promise<boolean> {
  const hasClaimed = await publicClient.readContract({
    address: WAFFLE_CONTRACT_ADDRESS,
    abi: waffleGameAbi,
    functionName: "hasClaimed",
    args: [onchainId, playerAddress],
  });

  return hasClaimed as boolean;
}
