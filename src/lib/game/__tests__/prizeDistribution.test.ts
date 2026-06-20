import { describe, it, expect } from "vitest";

import {
  calculatePrizeDistribution,
  formatDistribution,
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

function createPlayers(count: number, baseScore = 1000, paidAmount = 1): PlayerEntry[] {
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: `entry-${index}`,
      userId: `user-${index}`,
      score: baseScore - index * 10,
      paidAmount,
      username: `player${index + 1}`,
    })
  );
}

describe("Prize Distribution Algorithm", () => {
  it("uses the provided prize pool without deducting another platform fee", () => {
    const result = calculatePrizeDistribution(createPlayers(10), 1000);

    expect(result.prizePool).toBe(1000);
    expect(result.allocations.reduce((sum, allocation) => sum + allocation.prize, 0))
      .toBeCloseTo(1000, 6);
  });

  it("distributes the full prize pool", () => {
    const result = calculatePrizeDistribution(createPlayers(25), 25);
    const validation = validateDistribution(result);
    const totalPrizes = result.allocations.reduce((sum, allocation) => sum + allocation.prize, 0);

    expect(validation.valid).toBe(true);
    expect(totalPrizes).toBeCloseTo(result.prizePool, 6);
  });

  it("uses 100% for a solo paid entrant", () => {
    const result = calculatePrizeDistribution([createPlayer()], 25);

    expect(result.allocations[0].prize).toBeCloseTo(25, 6);
    expect(result.allocations[0].tier).toBe("podium");
  });

  it("uses winner-take-all for up to four paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(4), 4);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(1);
    expect(winners[0].prize).toBeCloseTo(4, 6);
  });

  it("uses the top-3 bracket for 5-9 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(5), 5);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(3);
    expect(winners[0].prize).toBeCloseTo(2.5, 6);
    expect(winners[1].prize).toBeCloseTo(1.5, 6);
    expect(winners[2].prize).toBeCloseTo(1, 6);
  });

  it("keeps a single winner when only two paid entrants exist", () => {
    const result = calculatePrizeDistribution(createPlayers(2), 2);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(1);
    expect(winners[0].prize).toBeCloseTo(2, 6);
  });

  it("uses the top-5 generous bracket for 8-14 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(9), 9);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(5);
    expect(winners[0].prize).toBeCloseTo(2.79, 6);
    expect(winners[1].prize).toBeCloseTo(2.07, 6);
    expect(winners[2].prize).toBeCloseTo(1.62, 6);
    expect(winners[3].prize).toBeCloseTo(1.35, 6);
    expect(winners[4].prize).toBeCloseTo(1.17, 6);
  });

  it("uses the top-12 generous bracket for 25-39 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(25), 25);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(12);
    expect(winners[0].prize).toBeCloseTo(5.5, 6);
    expect(winners[1].prize).toBeCloseTo(3.75, 6);
    expect(winners[2].prize).toBeCloseTo(2.75, 6);
    expect(winners[3].prize).toBeCloseTo(2.25, 6);
    expect(winners[4].prize).toBeCloseTo(2, 6);
    expect(winners[5].prize).toBeCloseTo(1.75, 6);
    expect(winners[6].prize).toBeCloseTo(1.5, 6);
    expect(winners[7].prize).toBeCloseTo(1.25, 6);
    expect(winners[8].prize).toBeCloseTo(1.25, 6);
    expect(winners[9].prize).toBeCloseTo(1, 6);
    expect(winners[10].prize).toBeCloseTo(1, 6);
    expect(winners[11].prize).toBeCloseTo(1, 6);
    expect(result.podiumTotal).toBeCloseTo(12, 6);
    expect(result.runnersTotal).toBeCloseTo(13, 6);
  });

  it("uses the top-15 bracket for 40-100 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(100), 100);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(15);
    expect(winners[0].prize).toBeCloseTo(22, 6);
    expect(winners[1].prize).toBeCloseTo(14, 6);
    expect(winners[2].prize).toBeCloseTo(10, 6);
    expect(winners[3].prize).toBeCloseTo(8, 6);
    expect(winners[4].prize).toBeCloseTo(7, 6);
    expect(winners[5].prize).toBeCloseTo(6, 6);
    expect(winners[6].prize).toBeCloseTo(5, 6);
    expect(winners[7].prize).toBeCloseTo(5, 6);
    expect(winners[8].prize).toBeCloseTo(4, 6);
    expect(winners[9].prize).toBeCloseTo(4, 6);
    expect(winners[10].prize).toBeCloseTo(3.5, 6);
    expect(winners[11].prize).toBeCloseTo(3, 6);
    expect(winners[12].prize).toBeCloseTo(3, 6);
    expect(winners[13].prize).toBeCloseTo(2.75, 6);
    expect(winners[14].prize).toBeCloseTo(2.75, 6);
  });

  it("uses the top-15 bracket for more than 100 paid entrants", () => {
    const result = calculatePrizeDistribution(createPlayers(101, 1000, 0.05), 20);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(WINNERS_COUNT);
    expect(winners[0].prize).toBeCloseTo(8, 6);
    expect(winners[1].prize).toBeCloseTo(2.8, 6);
    expect(winners[2].prize).toBeCloseTo(1.8, 6);
    expect(winners[3].prize).toBeCloseTo(1.2, 6);
    expect(winners[4].prize).toBeCloseTo(1, 6);
    expect(winners[5].prize).toBeCloseTo(0.8, 6);
    expect(winners[6].prize).toBeCloseTo(0.8, 6);
    expect(winners[7].prize).toBeCloseTo(0.6, 6);
    expect(winners[8].prize).toBeCloseTo(0.6, 6);
    expect(winners[9].prize).toBeCloseTo(0.5, 6);
    expect(winners[10].prize).toBeCloseTo(0.4, 6);
    expect(winners[11].prize).toBeCloseTo(0.4, 6);
    expect(winners[12].prize).toBeCloseTo(0.4, 6);
    expect(winners[13].prize).toBeCloseTo(0.4, 6);
    expect(winners[14].prize).toBeCloseTo(0.3, 6);
  });

  it("does not award prizes below the entrant's ticket amount", () => {
    const result = calculatePrizeDistribution(createPlayers(8, 1000, 0.05), 0.32);
    const winners = result.allocations.filter((allocation) => allocation.prize > 0);

    expect(winners).toHaveLength(4);
    expect(winners.every((winner) => winner.prize >= 0.05)).toBe(true);
    expect(winners.reduce((sum, winner) => sum + winner.prize, 0)).toBeCloseTo(0.32, 6);
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

    expect(result.prizePool).toBe(0);
    expect(result.allocations.every((allocation) => allocation.prize === 0)).toBe(true);
  });

  it("formats distribution output for logging", () => {
    const formatted = formatDistribution(
      calculatePrizeDistribution(createPlayers(25), 25)
    );

    expect(formatted).toContain("Prize Distribution");
    expect(formatted).toContain("Prize Pool");
  });

  it("keeps the published constants intact", () => {
    expect(WINNERS_COUNT).toBe(15);
  });
});
