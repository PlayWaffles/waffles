import { NextRequest, NextResponse } from "next/server";

import { UserPlatform } from "@prisma";
import { assertProductionCron, env } from "@/lib/env";
import { ensureHourlyTournamentGame } from "@/lib/player/tournamentGames";

export const maxDuration = 60;

/**
 * Ensures each platform has a live hourly tournament `Game` (on-chain, with
 * questions). Idempotent — a no-op when the current hour already has one.
 * Register on an hourly schedule alongside the game lifecycle settlement cron.
 */
export async function POST(request: NextRequest) {
  const productionOnly = assertProductionCron();
  if (productionOnly) {
    return NextResponse.json(productionOnly, { status: 404 });
  }

  if (request.headers.get("Authorization") !== `Bearer ${env.authSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platforms = [UserPlatform.FARCASTER, UserPlatform.MINIPAY] as const;
  const results = [];
  for (const platform of platforms) {
    try {
      results.push({ platform, ...(await ensureHourlyTournamentGame(platform)) });
    } catch (error) {
      results.push({
        platform,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ results });
}
