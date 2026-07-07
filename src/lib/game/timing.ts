/**
 * Game timing authority — single source for phase derivation and capability guards.
 *
 * Routes and actions call checkTiming() (or canJoin/canAnswer/…) instead of
 * re-implementing date predicates. Adapters map denial codes to HTTP status.
 */

import { CLAIM_DELAY_MS } from "@/lib/constants";

export const TICKET_CLOSE_BUFFER_MS = 5 * 60 * 1000;

export type GamePhase = "SCHEDULED" | "LIVE" | "ENDED";

export interface GameTiming {
  startsAt: Date;
  endsAt: Date;
  ticketsOpenAt?: Date | null;
}

export type TimingCapability =
  | "join"
  | "leave"
  | "answer"
  | "purchase_ticket"
  | "claim";

export type TimingDenial = {
  allowed: false;
  code: string;
  error: string;
  claimOpensAt?: Date;
  remainingMs?: number;
};

export type TimingAllowance = { allowed: true };

export type TimingGuardResult = TimingDenial | TimingAllowance;

/** Derive game phase from timing. Time is the source of truth. */
export function getPhase(game: GameTiming, now = new Date()): GamePhase {
  const nowMs = now.getTime();
  const startMs = game.startsAt.getTime();
  const endMs = game.endsAt.getTime();

  if (nowMs < startMs) return "SCHEDULED";
  if (nowMs < endMs) return "LIVE";
  return "ENDED";
}

/** Backward-compatible alias used across API routes and admin UI. */
export const getGamePhase = getPhase;

export function getTicketCloseTime(endsAt: Date): Date {
  return new Date(endsAt.getTime() - TICKET_CLOSE_BUFFER_MS);
}

export function areTicketsClosedForGame(
  game: { endsAt: Date },
  now = new Date(),
): boolean {
  return now >= getTicketCloseTime(game.endsAt);
}

export function getClaimOpensAt(endsAt: Date): Date {
  return new Date(endsAt.getTime() + CLAIM_DELAY_MS);
}

function deny(
  code: string,
  error: string,
  extra?: Pick<TimingDenial, "claimOpensAt" | "remainingMs">,
): TimingDenial {
  return { allowed: false, code, error, ...extra };
}

export function checkTiming(
  capability: TimingCapability,
  game: GameTiming,
  now = new Date(),
): TimingGuardResult {
  const phase = getPhase(game, now);

  switch (capability) {
    case "join":
      if (phase === "ENDED") {
        return deny("GAME_ENDED", "Game has ended");
      }
      return { allowed: true };

    case "leave":
      if (phase !== "LIVE") {
        return deny("NOT_LIVE", "Can only leave during live game");
      }
      return { allowed: true };

    case "answer":
      if (phase === "SCHEDULED") {
        return deny("NOT_STARTED", "Game not started");
      }
      if (phase === "ENDED") {
        return deny("GAME_ENDED", "Game has ended");
      }
      return { allowed: true };

    case "purchase_ticket":
      if (game.ticketsOpenAt && now < game.ticketsOpenAt) {
        return deny("TICKETS_NOT_OPEN", "Tickets are not yet available");
      }
      if (areTicketsClosedForGame(game, now)) {
        return deny("TICKETS_CLOSED", "Ticket sales have closed");
      }
      return { allowed: true };

    case "claim": {
      if (phase !== "ENDED") {
        return deny("GAME_NOT_ENDED", "Game has not ended yet");
      }
      const claimOpensAt = getClaimOpensAt(game.endsAt);
      if (now < claimOpensAt) {
        return deny("CLAIM_NOT_OPEN", "Claim window not yet open", {
          claimOpensAt,
          remainingMs: claimOpensAt.getTime() - now.getTime(),
        });
      }
      return { allowed: true };
    }
  }
}

export const canJoin = (game: GameTiming, now?: Date) =>
  checkTiming("join", game, now);

export const canLeave = (game: GameTiming, now?: Date) =>
  checkTiming("leave", game, now);

export const canAnswer = (game: GameTiming, now?: Date) =>
  checkTiming("answer", game, now);

export const canPurchaseTicket = (game: GameTiming, now?: Date) =>
  checkTiming("purchase_ticket", game, now);

export const canClaim = (game: GameTiming, now?: Date) =>
  checkTiming("claim", game, now);

/** HTTP status mapping for route adapters. */
export const TIMING_ERROR_STATUS: Record<string, number> = {
  GAME_ENDED: 400,
  NOT_LIVE: 400,
  NOT_STARTED: 409,
  TICKETS_NOT_OPEN: 409,
  TICKETS_CLOSED: 409,
  CLAIM_NOT_OPEN: 400,
  GAME_NOT_ENDED: 400,
};

export function timingErrorStatus(code: string, fallback = 500): number {
  return TIMING_ERROR_STATUS[code] ?? fallback;
}