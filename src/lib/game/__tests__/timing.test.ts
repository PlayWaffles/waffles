import { describe, it, expect } from "vitest";

import {
  getPhase,
  canJoin,
  canLeave,
  canAnswer,
  canPurchaseTicket,
  canClaim,
  getClaimOpensAt,
  getTicketCloseTime,
} from "../timing";

const startsAt = new Date("2026-07-07T12:00:00.000Z");
const endsAt = new Date("2026-07-07T16:00:00.000Z");
const ticketsOpenAt = new Date("2026-07-07T11:55:00.000Z");

const game = { startsAt, endsAt, ticketsOpenAt };

describe("game timing authority", () => {
  it("derives phase from timestamps", () => {
    expect(getPhase(game, new Date("2026-07-07T11:00:00.000Z"))).toBe("SCHEDULED");
    expect(getPhase(game, new Date("2026-07-07T13:00:00.000Z"))).toBe("LIVE");
    expect(getPhase(game, new Date("2026-07-07T17:00:00.000Z"))).toBe("ENDED");
  });

  it("allows join before end, blocks after", () => {
    expect(canJoin(game, new Date("2026-07-07T13:00:00.000Z"))).toEqual({ allowed: true });
    const denied = canJoin(game, new Date("2026-07-07T17:00:00.000Z"));
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.code).toBe("GAME_ENDED");
  });

  it("allows leave only while live", () => {
    expect(canLeave(game, new Date("2026-07-07T13:00:00.000Z"))).toEqual({ allowed: true });
    const denied = canLeave(game, new Date("2026-07-07T11:00:00.000Z"));
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.code).toBe("NOT_LIVE");
  });

  it("guards answers with NOT_STARTED and GAME_ENDED", () => {
    const early = canAnswer(game, new Date("2026-07-07T11:00:00.000Z"));
    expect(early.allowed).toBe(false);
    if (!early.allowed) expect(early.code).toBe("NOT_STARTED");

    expect(canAnswer(game, new Date("2026-07-07T13:00:00.000Z"))).toEqual({ allowed: true });

    const late = canAnswer(game, new Date("2026-07-07T17:00:00.000Z"));
    expect(late.allowed).toBe(false);
    if (!late.allowed) expect(late.code).toBe("GAME_ENDED");
  });

  it("guards ticket purchase with open and close windows", () => {
    const early = canPurchaseTicket(game, new Date("2026-07-07T11:50:00.000Z"));
    expect(early.allowed).toBe(false);
    if (!early.allowed) expect(early.code).toBe("TICKETS_NOT_OPEN");

    expect(canPurchaseTicket(game, new Date("2026-07-07T13:00:00.000Z"))).toEqual({
      allowed: true,
    });

    const closeTime = getTicketCloseTime(endsAt);
    const late = canPurchaseTicket(game, closeTime);
    expect(late.allowed).toBe(false);
    if (!late.allowed) expect(late.code).toBe("TICKETS_CLOSED");
  });

  it("guards claim until delay after game end", () => {
    const ended = canClaim(game, new Date("2026-07-07T16:30:00.000Z"));
    expect(ended.allowed).toBe(false);
    if (!ended.allowed) {
      expect(ended.code).toBe("CLAIM_NOT_OPEN");
      expect(ended.claimOpensAt).toEqual(getClaimOpensAt(endsAt));
    }

    expect(canClaim(game, getClaimOpensAt(endsAt))).toEqual({ allowed: true });
  });
});