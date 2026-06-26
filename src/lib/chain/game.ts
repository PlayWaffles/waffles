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
  getPaymentTokenAddress,
  getWaffleContractAddress,
} from "./config";
import { type ChainPlatform } from "./platform";
import type { GameNetwork } from "./network";

const CREATE_GAME_GAS_LIMIT = BigInt(120_000);
const CREATE_GAME_RETRY_LIMIT = 3;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
  const tokenAddress = getPaymentTokenAddress(chainTarget);
  const minimumTicketPrice = parseUnits(
    minTicketPriceUSDC.toString(),
    PAYMENT_TOKEN_DECIMALS,
  );

  // Balance sampled right before the failing send (declared out here so the
  // catch can read it), so an "insufficient funds" message reports what that
  // transaction actually saw — not a value re-read after the failure, which can
  // race a just-landed funding tx and print a healthy balance next to a
  // gas-failure (misleading).
  let balanceAtSend: bigint | null = null;

  try {
    const [tokenCode, contractToken] = await Promise.all([
      publicClient.getBytecode({ address: tokenAddress }),
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "paymentToken",
      }) as Promise<`0x${string}`>,
    ]);

    if (!tokenCode || tokenCode === "0x") {
      throw new Error(
        `${platform} ${network} payment token ${tokenAddress} is not deployed.`,
      );
    }

    if (contractToken.toLowerCase() === ZERO_ADDRESS) {
      throw new Error(
        `${platform} ${network} Waffle contract ${contractAddress} has no payment token configured.`,
      );
    }

    if (contractToken.toLowerCase() !== tokenAddress.toLowerCase()) {
      throw new Error(
        `${platform} ${network} Waffle contract ${contractAddress} uses payment token ${contractToken}, but the app is configured for ${tokenAddress}.`,
      );
    }

    const request = withBuilderCodeDataSuffix({
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "createGame",
      args: [onchainId, minimumTicketPrice],
    }, chainTarget);

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= CREATE_GAME_RETRY_LIMIT; attempt += 1) {
      try {
        balanceAtSend = await publicClient.getBalance({
          address: walletClient.account.address,
        });
        const hash = await walletClient.writeContract({
          ...request,
          gas: CREATE_GAME_GAS_LIMIT,
        });

        console.log(`[Chain] Created game ${onchainId}. TX: ${hash}`);
        return hash;
      } catch (error) {
        lastError = error;
        if (attempt === CREATE_GAME_RETRY_LIMIT) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    throw lastError;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/insufficient funds/i.test(message)) {
      const chainName = walletClient.chain.name;
      const nativeSymbol = walletClient.chain.nativeCurrency.symbol;
      const formattedBalance = formatEther(balanceAtSend ?? 0n);
      const shortAddress = `${walletClient.account.address.slice(0, 6)}...${walletClient.account.address.slice(-4)}`;

      throw new Error(
        `${platform} operator wallet ${shortAddress} had ${formattedBalance} ${nativeSymbol} on ${chainName} at the time of the attempt, so it could not pay gas to create the game. Fund that wallet with testnet ${nativeSymbol} and try again.`,
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
    }, chainTarget),
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
  } catch {
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
