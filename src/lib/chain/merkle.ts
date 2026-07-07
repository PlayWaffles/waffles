/**
 * Merkle Tree Utility for WaffleGame Prize Distribution
 *
 * Uses @openzeppelin/merkle-tree for standard, audited implementation.
 * Tree format matches the contract's claimPrize verification.
 */

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

/**
 * Represents a winner in the Merkle tree
 */
export interface Winner {
  gameId: `0x${string}`; // bytes32 on-chain game ID
  address: `0x${string}`;
  amount: bigint; // In token units (e.g., USDC has 6 decimals)
}

/**
 * Merkle tree result with root and tree reference
 */
export interface MerkleTreeResult {
  root: `0x${string}`;
  tree: StandardMerkleTree<[string, string, bigint]>;
}

/**
 * Builds a Merkle tree from a list of winners
 *
 * Leaf format: [gameId, playerAddress, amount]
 * This matches the contract's verification: keccak256(abi.encode(gameId, player, amount))
 * gameId is bytes32 on-chain
 */
export function buildMerkleTree(winners: Winner[]): MerkleTreeResult {
  if (winners.length === 0) {
    throw new Error("Cannot build Merkle tree with no winners");
  }

  // Convert winners to leaf format: [gameId (bytes32), address, amount]
  const leaves = winners.map(
    (w) => [w.gameId, w.address, w.amount] as [string, string, bigint]
  );

  // Build tree with OpenZeppelin library
  // Uses double hashing internally, matching Solidity's keccak256(bytes.concat(keccak256(...)))
  const tree = StandardMerkleTree.of(leaves, ["bytes32", "address", "uint256"]);

  return {
    root: tree.root as `0x${string}`,
    tree,
  };
}

export type WinnerProofMap = Map<
  string,
  { amount: bigint; proof: `0x${string}`[] }
>;

function proofsFromTree(
  tree: StandardMerkleTree<[string, string, bigint]>,
): WinnerProofMap {
  const proofs: WinnerProofMap = new Map();

  for (const [i, leaf] of tree.entries()) {
    const [, leafAddress, leafAmount] = leaf;
    const proof = tree.getProof(i) as `0x${string}`[];
    proofs.set(leafAddress.toLowerCase(), {
      amount: leafAmount as unknown as bigint,
      proof,
    });
  }

  return proofs;
}

/**
 * Generates Merkle proofs for all winners at once.
 * Pass an existing tree result to avoid rebuilding the tree.
 */
export function generateAllProofs(
  winners: Winner[],
  existing?: MerkleTreeResult,
): WinnerProofMap {
  if (winners.length === 0) return new Map();
  const treeResult = existing ?? buildMerkleTree(winners);
  return proofsFromTree(treeResult.tree);
}

/**
 * Build the Merkle tree and all winner proofs in one pass.
 */
export function buildMerkleTreeWithProofs(winners: Winner[]): {
  root: `0x${string}`;
  tree: StandardMerkleTree<[string, string, bigint]>;
  proofs: WinnerProofMap;
} {
  const treeResult = buildMerkleTree(winners);
  return {
    root: treeResult.root,
    tree: treeResult.tree,
    proofs: proofsFromTree(treeResult.tree),
  };
}

/**
 * Verifies a Merkle proof (for testing)
 */
export function verifyMerkleProof(
  root: `0x${string}`,
  winner: Winner,
  proof: `0x${string}`[]
): boolean {
  const leaf: [string, string, bigint] = [
    winner.gameId,
    winner.address,
    winner.amount,
  ];

  return StandardMerkleTree.verify(
    root,
    ["bytes32", "address", "uint256"],
    leaf,
    proof
  );
}

