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
import { TicketLedgerReason, WinningStatus } from "@prisma";
import { adjustTickets } from "./playerState";

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
    if (existing) return { entryId: existing.id, tickets: null, alreadyEntered: true };

    const tickets = await adjustTickets(userId, -TOURNAMENT_TICKET_COST, TicketLedgerReason.TOURNAMENT_ENTRY, {
      refId: String(roundId),
      tx,
    });
    const entry = await tx.roundEntry.create({
      data: { userId, roundId: BigInt(roundId), bonus },
      select: { id: true },
    });
    return { entryId: entry.id, tickets, alreadyEntered: false };
  });
}

/** Post a provisional score for the player's entry in a round. */
export async function submitRoundScore(userId: string, roundId: number, score: number): Promise<void> {
  await prisma.roundEntry.updateMany({
    where: { userId, roundId: BigInt(roundId), settled: false },
    data: { score },
  });
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
        await tx.winning.create({
          data: {
            userId: e.userId,
            roundId: BigInt(roundId),
            rank: finalRank,
            tickets: reward,
            status: WinningStatus.PENDING,
          },
        });
      }
    });
    if (reward > 0) prizes++;
  }
  return { settled: entries.length, prizes };
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
