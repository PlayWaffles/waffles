/**
 * Game On-Chain Operations
 * Functions for creating, ending, and querying games on-chain
 * Updated for WaffleGame v5
 */

import { formatEther, parseUnits } from "viem";

import { getPublicClient, getOperatorWalletClient } from "./client";
import { waffleGameAbi } from "./abi";
import { withBuilderCodeDataSuffix } from "./builderCode";
import {
  PAYMENT_TOKEN_DECIMALS,
  getWaffleContractAddress,
} from "./config";
import { type ChainPlatform } from "./platform";
import type { GameNetwork } from "./network";

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
  platform: ChainPlatform,
  network: GameNetwork,
  onchainId: `0x${string}`,
  minTicketPriceUSDC: number,
): Promise<`0x${string}`> {
  const chainTarget = { platform, network };
  const walletClient = getOperatorWalletClient(chainTarget);
  const publicClient = getPublicClient(chainTarget);
  const contractAddress = getWaffleContractAddress(chainTarget);
  const minimumTicketPrice = parseUnits(
    minTicketPriceUSDC.toString(),
    PAYMENT_TOKEN_DECIMALS,
  );

  try {
    const hash = await walletClient.writeContract(
      withBuilderCodeDataSuffix({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "createGame",
        args: [onchainId, minimumTicketPrice],
      }),
    );

    console.log(`[Chain] Created game ${onchainId}. TX: ${hash}`);
    return hash;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/insufficient funds/i.test(message)) {
      const balance = await publicClient.getBalance({
        address: walletClient.account.address,
      });
      const chainName = walletClient.chain.name;
      const nativeSymbol = walletClient.chain.nativeCurrency.symbol;
      const formattedBalance = formatEther(balance);
      const shortAddress = `${walletClient.account.address.slice(0, 6)}...${walletClient.account.address.slice(-4)}`;

      throw new Error(
        `${platform} operator wallet ${shortAddress} has ${formattedBalance} ${nativeSymbol} on ${chainName}, so it cannot pay gas to create the game. Fund that wallet with testnet ${nativeSymbol} and try again.`,
      );
    }

    throw error;
  }
}

/**
 * Close sales for a game on-chain (stops ticket purchases)
 * @param onchainId - The bytes32 on-chain game ID
 * @returns Transaction hash
 */
export async function closeSalesOnChain(
  platform: ChainPlatform,
  network: GameNetwork | null | undefined,
  onchainId: `0x${string}`,
): Promise<`0x${string}`> {
  const chainTarget = { platform, network };
  const walletClient = getOperatorWalletClient(chainTarget);
  const contractAddress = getWaffleContractAddress(chainTarget);

  const hash = await walletClient.writeContract(
    withBuilderCodeDataSuffix({
      address: contractAddress,
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
  platform: ChainPlatform,
  network: GameNetwork | null | undefined,
  onchainId: `0x${string}`,
): Promise<OnChainGame | null> {
  try {
    const chainTarget = { platform, network };
    const publicClient = getPublicClient(chainTarget);
    const contractAddress = getWaffleContractAddress(chainTarget);
    const game = (await publicClient.readContract({
      address: contractAddress,
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
  platform: ChainPlatform,
  network: GameNetwork | null | undefined,
  onchainId: `0x${string}`,
  playerAddress: `0x${string}`,
): Promise<boolean> {
  const chainTarget = { platform, network };
  const publicClient = getPublicClient(chainTarget);
  const contractAddress = getWaffleContractAddress(chainTarget);
  const hasTicket = await publicClient.readContract({
    address: contractAddress,
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
  platform: ChainPlatform,
  network: GameNetwork | null | undefined,
  onchainId: `0x${string}`,
  playerAddress: `0x${string}`,
): Promise<boolean> {
  const chainTarget = { platform, network };
  const publicClient = getPublicClient(chainTarget);
  const contractAddress = getWaffleContractAddress(chainTarget);
  const hasClaimed = await publicClient.readContract({
    address: contractAddress,
    abi: waffleGameAbi,
    functionName: "hasClaimed",
    args: [onchainId, playerAddress],
  });

  return hasClaimed as boolean;
}
