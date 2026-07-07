/**
 * Tournament entry adapter for the ticket settlement module.
 */

import { trackServerEvent } from "@/lib/server-analytics";
import { grantTournamentPracticePlays } from "@/lib/player/playerState";
import { skipRookieCup } from "@/lib/player/rookieCup";
import { getPhase } from "./timing";
import {
  type TicketSettlementHooks,
  type TicketSettlementResult,
  type TicketSettlementUser,
} from "./ticket-settlement";

function fail(
  error: string,
  code?: string,
): TicketSettlementResult {
  return { success: false, error, code };
}

export function tournamentEntryHooks(options: {
  entrySource: string;
  skillBonus: number;
}): TicketSettlementHooks {
  return {
    logTag: "buy-ticket",
    validateAccess: ({ game }) => {
      if (!game.onchainId) {
        return fail("game_not_onchain");
      }
      if (getPhase(game) === "ENDED") {
        return fail("game_ended");
      }
      return null;
    },
    resolveVerifyAmount: ({ game }) => {
      const entryFee = game.tierPrices[0] ?? 0.1;
      return { verifyAmount: entryFee };
    },
    entryExtras: () => ({
      bonusScore: options.skillBonus,
      score: options.skillBonus,
    }),
    onCreateInTx: async (tx, { game, user, verifiedAmount, input }) => {
      await trackServerEvent({
        name: "ticket_purchase_authoritative",
        userId: user.id,
        tx,
        properties: {
          game_id: game.id,
          onchain_id: game.onchainId,
          platform: game.platform,
          revenue: verifiedAmount,
          currency: "USD",
          entry_fee: verifiedAmount,
          entry_source: options.entrySource,
          tx_hash: input.txHash,
        },
      });
    },
    onEntryCreated: async ({ user }) => {
      try {
        await grantTournamentPracticePlays(user.id);
      } catch (e) {
        console.error("[buy-ticket] practice top-up failed", {
          userId: user.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      try {
        await skipRookieCup(user.id);
      } catch (e) {
        console.error("[buy-ticket] rookie forfeit failed", {
          userId: user.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    },
  };
}

export type { TicketSettlementUser };