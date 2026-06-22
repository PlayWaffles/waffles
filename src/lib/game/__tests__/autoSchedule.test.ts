import { describe, expect, it } from "vitest";
import {
  buildNextAutoGameSchedule,
  getNextAutoGameStart,
} from "@/lib/game/auto-schedule";

describe("auto game scheduling", () => {
  it("starts the next game the moment the last one ends (back-to-back hourly)", () => {
    const lastEndsAt = new Date("2026-04-06T15:00:00.000Z");
    const now = new Date("2026-04-06T14:30:00.000Z"); // last game still live

    expect(getNextAutoGameStart(lastEndsAt, now)).toEqual(
      new Date("2026-04-06T15:00:00.000Z"),
    );
  });

  it("stays back-to-back even when the cron fires a beat after the last game ends", () => {
    const lastEndsAt = new Date("2026-04-06T15:00:00.000Z");
    const now = new Date("2026-04-06T15:00:10.000Z"); // 10s late

    expect(getNextAutoGameStart(lastEndsAt, now)).toEqual(
      new Date("2026-04-06T15:00:00.000Z"),
    );
  });

  it("re-aligns to the top of the current hour when a whole hour or more was missed", () => {
    const lastEndsAt = new Date("2026-04-06T13:00:00.000Z");
    const now = new Date("2026-04-06T15:20:00.000Z"); // >1h since last end

    expect(getNextAutoGameStart(lastEndsAt, now)).toEqual(
      new Date("2026-04-06T15:00:00.000Z"),
    );
  });

  it("uses a 1-hour duration and preserves ticket lead time when still in the future", () => {
    const schedule = buildNextAutoGameSchedule(
      {
        startsAt: new Date("2026-04-03T14:00:00.000Z"),
        endsAt: new Date("2026-04-03T15:00:00.000Z"),
        ticketsOpenAt: new Date("2026-04-03T13:55:00.000Z"), // 5m lead
      },
      new Date("2026-04-03T14:30:00.000Z"), // last game still live
    );

    expect(schedule.startsAt).toEqual(new Date("2026-04-03T15:00:00.000Z"));
    expect(schedule.endsAt).toEqual(new Date("2026-04-03T16:00:00.000Z"));
    expect(schedule.ticketsOpenAt).toEqual(new Date("2026-04-03T14:55:00.000Z"));
  });

  it("opens tickets immediately (null) when the inherited lead would already be in the past", () => {
    const schedule = buildNextAutoGameSchedule(
      {
        startsAt: new Date("2026-04-03T12:00:00.000Z"),
        endsAt: new Date("2026-04-03T13:00:00.000Z"),
        ticketsOpenAt: new Date("2026-04-03T11:55:00.000Z"), // 5m lead
      },
      new Date("2026-04-03T14:57:00.000Z"),
    );

    // last game ended >1h ago → re-aligned to top of current hour (15:00)
    expect(schedule.startsAt).toEqual(new Date("2026-04-03T15:00:00.000Z"));
    // 5m lead → 14:55, which is before now (14:57) → null
    expect(schedule.ticketsOpenAt).toBe(null);
  });
});
