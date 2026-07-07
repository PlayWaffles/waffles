import { describe, it, expect } from "vitest";
import { parseUnits } from "viem";

import {
  buildMerkleTree,
  buildMerkleTreeWithProofs,
  generateAllProofs,
  verifyMerkleProof,
  type Winner,
} from "../merkle";

const GAME_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as const;

function winner(
  address: string,
  amountUsdc: number,
): Winner {
  return {
    gameId: GAME_ID,
    address: address as `0x${string}`,
    amount: parseUnits(amountUsdc.toFixed(6), 6),
  };
}

describe("merkle settlement", () => {
  const winners = [
    winner("0x1111111111111111111111111111111111111111", 5),
    winner("0x2222222222222222222222222222222222222222", 3),
    winner("0x3333333333333333333333333333333333333333", 2),
  ];

  it("buildMerkleTreeWithProofs matches generateAllProofs with a pre-built tree", () => {
    const combined = buildMerkleTreeWithProofs(winners);
    const treeOnly = buildMerkleTree(winners);
    const proofsFromExisting = generateAllProofs(winners, treeOnly);

    expect(combined.root).toBe(treeOnly.root);
    expect(combined.proofs.size).toBe(proofsFromExisting.size);

    for (const [address, proofData] of combined.proofs) {
      const other = proofsFromExisting.get(address);
      expect(other?.amount).toBe(proofData.amount);
      expect(other?.proof).toEqual(proofData.proof);
    }
  });

  it("verifies every generated proof against the root", () => {
    const { root, proofs } = buildMerkleTreeWithProofs(winners);

    for (const w of winners) {
      const proofData = proofs.get(w.address.toLowerCase());
      expect(!!proofData).toBe(true);
      expect(
        verifyMerkleProof(root, w, proofData!.proof),
      ).toBe(true);
    }
  });

  it("returns an empty proof map for no winners", () => {
    expect(generateAllProofs([]).size).toBe(0);
  });
});