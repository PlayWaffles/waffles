/**
 * Viem Clients for Chain Interaction
 *
 * Provides separate wallet clients for each on-chain role:
 * - Operator: createGame, closeSales
 * - Settler: submitResults, correctResultsRoot
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { env } from "@/lib/env";
import { getPlatformChain, getPlatformRpcUrl } from "./config";
import type { ChainPlatform } from "./platform";

// ============================================================================
// Public Client (Read-only)
// ============================================================================

const publicClientCache = new Map<ChainPlatform, ReturnType<typeof createPublicClient>>();

export function getPublicClient(platform: ChainPlatform) {
  let client = publicClientCache.get(platform);
  if (!client) {
    client = createPublicClient({
      chain: getPlatformChain(platform),
      transport: http(getPlatformRpcUrl(platform)),
    });
    publicClientCache.set(platform, client);
  }
  return client;
}

// ============================================================================
// Role-based Wallet Clients
// ============================================================================

/**
 * Get the operator wallet client for game creation and sales closure.
 * @throws Error if OPERATOR_PRIVATE_KEY is not set
 */
export function getOperatorWalletClient(platform: ChainPlatform) {
  const privateKey = env.operatorPrivateKey;
  if (!privateKey) {
    throw new Error("OPERATOR_PRIVATE_KEY environment variable not set");
  }
  return createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: getPlatformChain(platform),
    transport: http(getPlatformRpcUrl(platform)),
  });
}

/**
 * Get the settler wallet client for result submission.
 * @throws Error if SETTLER_PRIVATE_KEY is not set
 */
export function getSettlerWalletClient(platform: ChainPlatform) {
  const privateKey = env.settlerPrivateKey;
  if (!privateKey) {
    throw new Error("SETTLER_PRIVATE_KEY environment variable not set");
  }
  return createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: getPlatformChain(platform),
    transport: http(getPlatformRpcUrl(platform)),
  });
}
