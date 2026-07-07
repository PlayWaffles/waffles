/**
 * Post-rank settlement effects — best-effort rewards that must never fail ranking.
 * Kept behind the rank stage seam so the core ranking path stays testable.
 */

import { TicketLedgerReason } from "@prisma";
import { recordMissionEvent } from "@/lib/player/missions";
import { adjustTickets } from "@/lib/player/playerState";
import {
  consolationSyrup,
  type DistributionResult,
} from "./prizeDistribution";

const TOURNAMENT_WINNER_SYRUP_BONUS = 50;

export type RankedWinner = {
  rank: number;
  prize: number;
  userId: string;
};

export async function applyPostRankEffects(
  gameId: string,
  distribution: DistributionResult,
  winners: RankedWinner[],
): Promise<void> {
  const champion = winners.find((w) => w.rank === 1);
  if (champion) {
    try {
      await recordMissionEvent(champion.userId, "tournaments_won", 1);
    } catch (e) {
      console.error(
        `[Settlement] win-tournament mission accrual failed for ${champion.userId}:`,
        e,
      );
    }
  }

  for (const w of winners) {
    try {
      await adjustTickets(
        w.userId,
        TOURNAMENT_WINNER_SYRUP_BONUS,
        TicketLedgerReason.TOURNAMENT_REWARD,
        { refId: gameId, note: "tournament winner bonus" },
      );
    } catch (e) {
      console.error(
        `[Settlement] winner syrup bonus failed for ${w.userId}:`,
        e,
      );
    }
  }

  const fieldSize = distribution.allocations.length;
  for (const alloc of distribution.allocations) {
    const syrup = consolationSyrup(alloc.rank, fieldSize, alloc.prize > 0);
    if (syrup <= 0) continue;
    try {
      await adjustTickets(
        alloc.userId,
        syrup,
        TicketLedgerReason.TOURNAMENT_REWARD,
        { refId: gameId, note: "top-half consolation" },
      );
    } catch (e) {
      console.error(
        `[Settlement] consolation syrup failed for ${alloc.userId}:`,
        e,
      );
    }
  }
}