import { describe, expect, it } from "vitest";
import {
  buildNextAutoGameSchedule,
  getNextAutoGameStart,
} from "@/lib/game/auto-schedule";

describe("auto game scheduling", () => {
  it("uses the next allowed 14:00 UTC slot after a game ends", () => {
    const lastEndsAt = new Date("2026-04-06T15:00:00.000Z");

    expect(getNextAutoGameStart(lastEndsAt)).toEqual(
      new Date("2026-04-08T14:00:00.000Z"),
    );
  });

  it("skips the current day when 14:00 UTC is already earlier than end+1h", () => {
    const lastEndsAt = new Date("2026-04-06T13:30:00.000Z");
    const now = new Date("2026-04-06T13:45:00.000Z");

    expect(getNextAutoGameStart(lastEndsAt, now)).toEqual(
      new Date("2026-04-08T14:00:00.000Z"),
    );
  });

  it("uses a fixed 2 hour duration and preserves ticket lead time when still in the future", () => {
    const schedule = buildNextAutoGameSchedule(
      {
        startsAt: new Date("2026-04-03T14:00:00.000Z"),
        endsAt: new Date("2026-04-03T16:00:00.000Z"),
        ticketsOpenAt: new Date("2026-04-03T12:00:00.000Z"),
      },
      new Date("2026-04-05T12:00:00.000Z"),
    );

    expect(schedule.startsAt).toEqual(new Date("2026-04-06T14:00:00.000Z"));
    expect(schedule.endsAt).toEqual(new Date("2026-04-06T16:00:00.000Z"));
    expect(schedule.ticketsOpenAt).toEqual(new Date("2026-04-06T12:00:00.000Z"));
  });

  it("opens tickets immediately when the inherited lead time would already be in the past", () => {
    const schedule = buildNextAutoGameSchedule(
      {
        startsAt: new Date("2026-04-03T14:00:00.000Z"),
        endsAt: new Date("2026-04-03T16:00:00.000Z"),
        ticketsOpenAt: new Date("2026-04-03T12:00:00.000Z"),
      },
      new Date("2026-04-06T13:30:00.000Z"),
    );

    expect(schedule.startsAt).toEqual(new Date("2026-04-08T14:00:00.000Z"));
    expect(schedule.ticketsOpenAt).toBe(null);
  });
});
