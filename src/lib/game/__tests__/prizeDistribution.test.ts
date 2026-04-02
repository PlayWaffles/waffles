import { describe, it, expect } from "vitest";

import {
  calculatePrizeDistribution,
  formatDistribution,
  PLATFORM_FEE_BPS,
  validateDistribution,
  WINNERS_COUNT,
} from "../prizeDistribution";
import type { PlayerEntry } from "../prizeDistribution";

function createPlayer(overrides: Partial<PlayerEntry> = {}): PlayerEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    userId: `user-${Math.random().toString(36).slice(2)}`,
    score: 1000,
    paidAmount: 1,
    username: "testuser",
    ...overrides,
  };
}

function createPlayers(count: number, baseScore = 1000): PlayerEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: `entry-${index}`,
      userId: `user-${index}`,
      score: baseScore - index * 10,
      paidAmount: 1,
      username: `player${index + 1}`,
    })
  );
}

describe("Prize Distribution Algorithm", () => {
  it("deducts the 20% platform fee", () => {
    const result = calculatePrizeDistribution(createPlayers(10), 1000);

    expect(result.platformFee).toBe(200);
    expect(result.netPool).toBe(800);
  });

  it("distributes the full net pool", () => {
    const result = calculatePrizeDistribution(createPlayers(25), 25);
    const validation = validateDistribution(result);
    const totalPrizes = result.allocations.reduce((sum, allocation) => sum + allocation.prize, 0);

    expect(validation.valid).toBe(true);
    expect(totalPrizes).toBeCloseTo(result.netPool, 6);
  });

  it("uses 100% for a solo paid entrant", () => {
    const result = calculatePrizeDistribution([createPlayer()], 25);

    expect(result.allocations[0].prize).toBeCloseTo(20, 6);
    expect(result.allocations[0].tier).toBe("podium");
  });

  it("uses the top-3 bracket for 2-9 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(9), 9);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(3);
    expect(winners[0].prize).toBeCloseTo(3.6, 6);
    expect(winners[1].prize).toBeCloseTo(2.16, 6);
    expect(winners[2].prize).toBeCloseTo(1.44, 6);
  });

  it("normalizes the top-3 bracket when only two paid entrants exist", () => {
    const result = calculatePrizeDistribution(createPlayers(2), 2);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(2);
    expect(winners[0].prize).toBeCloseTo(1 * (0.5 / 0.8), 6);
    expect(winners[1].prize).toBeCloseTo(1 * (0.3 / 0.8), 6);
  });

  it("uses the top-5 bracket for 10-39 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(25), 25);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(5);
    expect(winners[0].prize).toBeCloseTo(10, 6);
    expect(winners[1].prize).toBeCloseTo(4, 6);
    expect(winners[2].prize).toBeCloseTo(3, 6);
    expect(winners[3].prize).toBeCloseTo(1.5, 6);
    expect(winners[4].prize).toBeCloseTo(1.5, 6);
    expect(result.podiumTotal).toBeCloseTo(17, 6);
    expect(result.runnersTotal).toBeCloseTo(3, 6);
  });

  it("uses the top-10 bracket for 40+ paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(100), 100);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(WINNERS_COUNT);
    expect(winners[0].prize).toBeCloseTo(40, 6);
    expect(winners[1].prize).toBeCloseTo(12, 6);
    expect(winners[2].prize).toBeCloseTo(8, 6);
    expect(winners[3].prize).toBeCloseTo(4, 6);
    expect(winners[4].prize).toBeCloseTo(4, 6);
    expect(winners[5].prize).toBeCloseTo(3.2, 6);
    expect(winners[6].prize).toBeCloseTo(3.2, 6);
    expect(winners[7].prize).toBeCloseTo(2, 6);
    expect(winners[8].prize).toBeCloseTo(2, 6);
    expect(winners[9].prize).toBeCloseTo(1.6, 6);
  });

  it("keeps unpaid entries ranked but prize-free", () => {
    const players = [
      createPlayer({ id: "1", score: 1000, paidAmount: 1 }),
      createPlayer({ id: "2", score: 900, paidAmount: 0 }),
      createPlayer({ id: "3", score: 800, paidAmount: 1 }),
    ];
    const result = calculatePrizeDistribution(players, 2);

    const unpaid = result.allocations.find((allocation) => allocation.entryId === "2");
    expect(unpaid?.prize).toBe(0);
    expect(unpaid?.tier).toBe("none");
  });

  it("returns zero prizes for a zero pool", () => {
    const result = calculatePrizeDistribution(createPlayers(5), 0);

    expect(result.netPool).toBe(0);
    expect(result.allocations.every((allocation) => allocation.prize === 0)).toBe(true);
  });

  it("formats distribution output for logging", () => {
    const formatted = formatDistribution(
      calculatePrizeDistribution(createPlayers(25), 25)
    );

    expect(formatted).toContain("Prize Distribution");
    expect(formatted).toContain("Gross Pool");
    expect(formatted).toContain("Platform Fee");
    expect(formatted).toContain("Net Pool");
  });

  it("keeps the published constants intact", () => {
    expect(WINNERS_COUNT).toBe(10);
    expect(PLATFORM_FEE_BPS).toBe(2000);
  });
});
