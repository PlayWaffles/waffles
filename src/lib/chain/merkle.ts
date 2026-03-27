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

/**
 * Generates Merkle proofs for all winners at once
 * Returns a map of address -> { amount, proof }
 */
export function generateAllProofs(
  winners: Winner[]
): Map<string, { amount: bigint; proof: `0x${string}`[] }> {
  if (winners.length === 0) return new Map();

  const { tree } = buildMerkleTree(winners);
  const proofs = new Map<string, { amount: bigint; proof: `0x${string}`[] }>();

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

