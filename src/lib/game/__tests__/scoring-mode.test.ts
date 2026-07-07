import { describe, it, expect } from "vitest";

import { isTournamentGame, TOURNAMENT_WINDOW_MS } from "../scoring-mode";
import { scoreTournamentRound } from "../scoring-authority";
import type { ScorableQuestion, RoundAnswer } from "@/lib/player/scoring";

describe("tournament game detection", () => {
  it("detects tournament windows", () => {
    const startsAt = new Date("2026-07-07T12:00:00.000Z");
    const endsAt = new Date(startsAt.getTime() + TOURNAMENT_WINDOW_MS);
    expect(isTournamentGame({ startsAt, endsAt })).toBe(true);
  });

  it("excludes legacy day-long games", () => {
    const startsAt = new Date("2026-07-07T12:00:00.000Z");
    const endsAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
    expect(isTournamentGame({ startsAt, endsAt })).toBe(false);
  });
});

describe("tournament scoring", () => {
  it("preserves full selections in answer records", () => {
    const issued: ScorableQuestion[] = [
      {
        id: "q1",
        kind: "multi",
        correct: 0,
        correctSet: [0, 2],
        pick: 2,
        correctOrder: [],
        minefield: false,
        durationSec: 10,
      },
    ];
    const answers: RoundAnswer[] = [
      { id: "q1", selection: [0, 2], responseMs: 1000 },
    ];

    const { roundScore, records } = scoreTournamentRound(issued, answers);
    expect(roundScore).toBeGreaterThan(0);
    expect(records.q1.selection).toEqual([0, 2]);
    expect(records.q1.kind).toBe("multi");
  });
});