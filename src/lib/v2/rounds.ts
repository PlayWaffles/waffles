/**
 * v2 hourly tournament rounds — server-authoritative entry + settlement.
 *
 * A round is the window [roundId, roundId + ROUND_MS). Players pay one ticket to
 * enter, post a provisional score, and at close the round settles: final ranks
 * are computed among actual entrants and prizes (ticket-denominated) are written
 * to the Prize Wallet (`Winning`). Mirrors the pure economy in
 * src/app/v2/_app/state.tsx but is the authoritative source (clients no longer
 * mint their own winnings).
 */
import { prisma } from "@/lib/db";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";
import { TicketLedgerReason, WinningStatus } from "@prisma";
import { adjustTickets } from "./playerState";
import { getRoundScorableSet } from "./roundQuestions";
import { scoreRound, type RoundAnswer } from "./scoring";

export const TOURNAMENT_TICKET_COST = 1;
export const TOURNAMENT_ROUND_MS = 60 * 60 * 1000; // production: hourly
export const TOURNAMENT_FIELD_SIZE = 2418; // simulated floor so early rounds feel full

export type PrizeTier = { maxRank: number; tickets: number };
export const TOURNAMENT_PRIZES: PrizeTier[] = [
  { maxRank: 1, tickets: 25 },
  { maxRank: 10, tickets: 10 },
  { maxRank: 100, tickets: 3 },
];

export const roundIdFor = (now: number): number =>
  Math.floor(now / TOURNAMENT_ROUND_MS) * TOURNAMENT_ROUND_MS;
export const roundCloseAt = (roundId: number): number => roundId + TOURNAMENT_ROUND_MS;

export function tournamentReward(rank: number): number {
  for (const tier of TOURNAMENT_PRIZES) if (rank <= tier.maxRank) return tier.tickets;
  return 0;
}

/** Enter the current round. One paid entry per round: re-entry returns the
 *  existing entry without charging. Returns the entry + new ticket balance. */
export async function enterRound(
  userId: string,
  roundId: number,
  bonus: boolean,
): Promise<{ entryId: string; tickets: number | null; alreadyEntered: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.roundEntry.findUnique({
      where: { userId_roundId: { userId, roundId: BigInt(roundId) } },
      select: { id: true },
    });
    if (existing) {
      await trackServerEvent({
        name: "round_entry_authoritative",
        userId,
        tx,
        properties: {
          round_id: roundId,
          already_entered: true,
          result: "existing",
        },
      });
      return { entryId: existing.id, tickets: null, alreadyEntered: true };
    }

    const tickets = await adjustTickets(userId, -TOURNAMENT_TICKET_COST, TicketLedgerReason.TOURNAMENT_ENTRY, {
      refId: String(roundId),
      tx,
    });
    const entry = await tx.roundEntry.create({
      data: { userId, roundId: BigInt(roundId), bonus },
      select: { id: true },
    });
    await trackServerEvent({
      name: "round_entry_authoritative",
      userId,
      tx,
      properties: {
        round_id: roundId,
        entry_cost: TOURNAMENT_TICKET_COST,
        tickets_after: tickets,
        daily_bonus_available: bonus,
        already_entered: false,
        result: "created",
      },
    });
    return { entryId: entry.id, tickets, alreadyEntered: false };
  });
}

/**
 * Submit the player's answers for a round and record a SERVER-COMPUTED score.
 *
 * The client posts the per-question answers it gave (selection + response time),
 * never a score. The server re-derives the round's authoritative question set,
 * re-scores those answers against its own answer key with clamped timing, and
 * caps the total at the round's theoretical max — so a tampered client can't
 * post an arbitrary number. Only unsettled entries are touched (no rescoring
 * after settlement), and the score never moves backward (idempotent resubmits /
 * late-arriving duplicates can't grief a higher score).
 */
export async function submitRoundAnswers(
  userId: string,
  roundId: number,
  answers: RoundAnswer[],
): Promise<{ score: number; updated: boolean } | null> {
  const issued = await getRoundScorableSet(roundId);
  const score = scoreRound(issued, answers);

  const result = await prisma.roundEntry.updateMany({
    where: {
      userId,
      roundId: BigInt(roundId),
      settled: false,
      OR: [{ score: null }, { score: { lt: score } }],
    },
    data: { score },
  });

  await trackServerEvent({
    name: "round_score_submitted_authoritative",
    userId,
    properties: {
      round_id: roundId,
      score_after: score,
      answer_count: answers?.length ?? 0,
      issued_count: issued.length,
      updated_count: result.count,
      result: result.count > 0 ? "updated" : "missing_or_not_higher",
    },
  });

  return { score, updated: result.count > 0 };
}

/**
 * Settle a closed round: rank actual entrants (by score desc), pay prizes to the
 * Prize Wallet, mark entries settled. Idempotent — only touches unsettled
 * entries. Intended to run from the round-close job (Phase 5: cron/PartyKit).
 */
export async function settleRound(roundId: number): Promise<{ settled: number; prizes: number }> {
  const entries = await prisma.roundEntry.findMany({
    where: { roundId: BigInt(roundId), settled: false },
    orderBy: { score: "desc" },
    select: { id: true, userId: true, score: true },
  });
  if (entries.length === 0) return { settled: 0, prizes: 0 };

  let prizes = 0;
  const now = new Date();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.score == null) {
      // Entered but never finished — forfeit, no prize.
      await prisma.roundEntry.update({
        where: { id: e.id },
        data: { settled: true, finalRank: null, reward: 0, settledAt: now },
      });
      continue;
    }
    const finalRank = i + 1; // dense rank among entrants (score-ordered)
    const reward = tournamentReward(finalRank);
    await prisma.$transaction(async (tx) => {
      await tx.roundEntry.update({
        where: { id: e.id },
        data: { settled: true, finalRank, reward, settledAt: now },
      });
      if (reward > 0) {
        const winning = await tx.winning.create({
          data: {
            userId: e.userId,
            roundId: BigInt(roundId),
            rank: finalRank,
            tickets: reward,
            status: WinningStatus.PENDING,
          },
          select: { id: true },
        });
        await trackServerEvent({
          name: "prize_created_authoritative",
          userId: e.userId,
          tx,
          properties: {
            round_id: roundId,
            rank: finalRank,
            reward_type: "tickets",
            reward_amount: reward,
            winning_id_hash: hashServerAnalyticsId(winning.id),
          },
        });
      }
      await trackServerEvent({
        name: "round_settlement_authoritative",
        userId: e.userId,
        tx,
        properties: {
          round_id: roundId,
          score_after: e.score,
          rank: finalRank,
          tickets_won: reward,
          result_state: reward > 0 ? "won" : "lost",
        },
      });
    });
    if (reward > 0) prizes++;
  }
  await trackServerEvent({
    name: "round_settlement_completed",
    properties: {
      round_id: roundId,
      settled_count: entries.length,
      prizes,
    },
  });
  return { settled: entries.length, prizes };
}

export type RoundStanding = { rank: number; userId: string; name: string; score: number; you: boolean };
export type RoundBoard = {
  roundId: number | null;
  fieldSize: number; // real number of entrants in the round
  standings: RoundStanding[];
  you: RoundStanding | null;
  settled: boolean;
};

/**
 * Real standings for a round (live position by score, or final rank once
 * settled). When no roundId is given, uses the latest round that has entries —
 * so the leaderboard always has the freshest real competition to show.
 */
export async function roundStandings(
  opts: { roundId?: number; userId?: string; limit?: number } = {},
): Promise<RoundBoard> {
  let roundId = opts.roundId ?? null;
  if (roundId == null) {
    const latest = await prisma.roundEntry.findFirst({
      orderBy: { roundId: "desc" },
      select: { roundId: true },
    });
    roundId = latest ? Number(latest.roundId) : null;
  }
  if (roundId == null) return { roundId: null, fieldSize: 0, standings: [], you: null, settled: false };

  const entries = await prisma.roundEntry.findMany({
    where: { roundId: BigInt(roundId) },
    orderBy: [{ score: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      userId: true,
      score: true,
      settled: true,
      finalRank: true,
      user: { select: { username: true } },
    },
  });
  const fieldSize = entries.length;
  const ranked: RoundStanding[] = entries.map((e, i) => ({
    rank: e.finalRank ?? i + 1,
    userId: e.userId,
    name: e.user.username ?? "Player",
    score: e.score ?? 0,
    you: !!opts.userId && opts.userId === e.userId,
  }));
  const limit = opts.limit ?? 20;
  return {
    roundId,
    fieldSize,
    standings: ranked.slice(0, limit),
    you: opts.userId ? ranked.find((r) => r.you) ?? null : null,
    settled: fieldSize > 0 && entries.every((e) => e.settled),
  };
}

/**
 * Sweep all rounds that have closed but still have unsettled entries, and settle
 * each. Driven by the `settle-rounds` cron (Phase 5). Idempotent.
 */
export async function settleClosedRounds(
  now = Date.now(),
): Promise<{ rounds: number; settled: number; prizes: number }> {
  const open = await prisma.roundEntry.findMany({
    where: { settled: false },
    distinct: ["roundId"],
    select: { roundId: true },
  });
  let rounds = 0;
  let settled = 0;
  let prizes = 0;
  for (const { roundId } of open) {
    const rid = Number(roundId);
    if (now < roundCloseAt(rid)) continue; // round still live — leave it
    const r = await settleRound(rid);
    rounds += 1;
    settled += r.settled;
    prizes += r.prizes;
  }
  return { rounds, settled, prizes };
}
