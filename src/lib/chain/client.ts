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
import { resolveChainTarget, type ChainTarget } from "./network";

// ============================================================================
// Public Client (Read-only)
// ============================================================================

const publicClientCache = new Map<string, ReturnType<typeof createPublicClient>>();

export function getPublicClient(target: ChainTarget) {
  const resolved = resolveChainTarget(target);
  const cacheKey = `${resolved.platform}:${resolved.network}`;
  let client = publicClientCache.get(cacheKey);
  if (!client) {
    client = createPublicClient({
      chain: getPlatformChain(resolved),
      transport: http(getPlatformRpcUrl(resolved)),
    });
    publicClientCache.set(cacheKey, client);
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
export function getOperatorWalletClient(target: ChainTarget) {
  const privateKey = env.operatorPrivateKey;
  if (!privateKey) {
    throw new Error("OPERATOR_PRIVATE_KEY environment variable not set");
  }
  return createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: getPlatformChain(target),
    transport: http(getPlatformRpcUrl(target)),
  });
}

/**
 * Get the settler wallet client for result submission.
 * @throws Error if SETTLER_PRIVATE_KEY is not set
 */
export function getSettlerWalletClient(target: ChainTarget) {
  const privateKey = env.settlerPrivateKey;
  if (!privateKey) {
    throw new Error("SETTLER_PRIVATE_KEY environment variable not set");
  }
  return createWalletClient({
    account: privateKeyToAccount(privateKey as `0x${string}`),
    chain: getPlatformChain(target),
    transport: http(getPlatformRpcUrl(target)),
  });
}
