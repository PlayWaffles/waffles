/**
 * Cron: Roundup Games
 * POST /api/cron/roundup-games
 *
 * Auto-ranks and publishes ended games that haven't settled yet. Called every 5 min.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertProductionCron, env } from "@/lib/env";
import { runGameRoundup } from "@/lib/game/roundup";
import { trackServerEvent } from "@/lib/server-analytics";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const productionOnly = assertProductionCron();
  if (productionOnly) {
    return NextResponse.json(productionOnly, { status: 404 });
  }

  if (request.headers.get("Authorization") !== `Bearer ${env.authSecret}`) {
    await trackServerEvent({
      name: "legacy_cron_roundup_unauthorized",
      properties: { cron: "roundup-games" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGameRoundup("http_cron");
    console.log(
      `[Cron] Done: ${result.ranked} ranked, ${result.published + result.republished} published, ${result.scheduledCreated} scheduled`,
    );
    return NextResponse.json(result);
  } catch (error) {
    await trackServerEvent({
      name: "cron_roundup_route_failed",
      properties: {
        duration_ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    throw error;
  }
}
