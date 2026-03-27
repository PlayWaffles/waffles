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
import { waffleGameAbi } from "./abi";
import { chain, WAFFLE_CONTRACT_ADDRESS } from "./config";

// ============================================================================
// Public Client (Read-only)
// ============================================================================

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

// ============================================================================
// Role-based Wallet Clients
// ============================================================================

/**
 * Get the operator wallet client for game creation and sales closure.
 * @throws Error if OPERATOR_PRIVATE_KEY is not set
 */
export function getOperatorWalletClient() {
  const privateKey = env.operatorPrivateKey;
  if (!privateKey) {
    throw new Error("OPERATOR_PRIVATE_KEY environment variable not set");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain,
    transport: http(),
  });
}

/**
 * Get the settler wallet client for result submission.
 * @throws Error if SETTLER_PRIVATE_KEY is not set
 */
export function getSettlerWalletClient() {
  const privateKey = env.settlerPrivateKey;
  if (!privateKey) {
    throw new Error("SETTLER_PRIVATE_KEY environment variable not set");
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain,
    transport: http(),
  });
}

