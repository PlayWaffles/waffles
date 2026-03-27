// Clients
export { publicClient, getOperatorWalletClient, getSettlerWalletClient } from "./client";

export {
  chain,
  PAYMENT_TOKEN_ADDRESS,
  PAYMENT_TOKEN_DECIMALS,
  WAFFLE_CONTRACT_ADDRESS,
} from "./config";
// Game operations
export {
  generateOnchainGameId,
  createGameOnChain,
  closeSalesOnChain,
  getOnChainGame,
  hasTicketOnChain,
  hasClaimedOnChain,
  type OnChainGame,
} from "./game";

// Game lifecycle (ranking, publishing) - NOT exported here because it's server-only
// Import directly from "@/lib/game/lifecycle" in server components/actions

// Merkle tree
export {
  buildMerkleTree,
  generateAllProofs,
  verifyMerkleProof,
  type Winner,
  type MerkleTreeResult,
} from "./merkle";

// Payment verification
export {
  verifyTicketPurchase,
  verifyClaim,
  waitForTransaction,
  type VerifyTicketPurchaseResult,
  type VerifyTicketPurchaseInput,
  type VerifyClaimResult,
  type VerifyClaimInput,
} from "./verify";
