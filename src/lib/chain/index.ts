// Clients
export { getPublicClient, getOperatorWalletClient, getSettlerWalletClient } from "./client";

export {
  farcasterChain,
  miniPayChain,
  PAYMENT_TOKEN_DECIMALS,
  getPaymentTokenAddress,
  getPlatformChain,
  getPlatformRpcUrl,
  getWaffleContractAddress,
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
  inspectTicketPurchase,
  verifyTicketPurchase,
  verifyClaim,
  waitForTransaction,
  type InspectTicketPurchaseResult,
  type TicketPurchaseDetails,
  type VerifyTicketPurchaseResult,
  type VerifyTicketPurchaseInput,
  type VerifyClaimResult,
  type VerifyClaimInput,
} from "./verify";
