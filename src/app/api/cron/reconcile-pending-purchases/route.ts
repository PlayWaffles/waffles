import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { safeRevalidateGamePaths } from "@/lib/game/cache";
import { processPendingPurchases } from "@/lib/game/pending-purchases";
import { trackServerEvent } from "@/lib/server-analytics";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (request.headers.get("Authorization") !== `Bearer ${env.partykitSecret}`) {
    await trackServerEvent({
      name: "cron_purchase_reconcile_unauthorized",
      properties: { cron: "reconcile-pending-purchases" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await trackServerEvent({
    name: "cron_purchase_reconcile_started",
    properties: { limit: 50 },
  });

  try {
    const result = await processPendingPurchases(50);
    if (result.synced > 0) {
      safeRevalidateGamePaths("cron/reconcile-pending-purchases");
    }
    await trackServerEvent({
      name: "cron_purchase_reconcile_succeeded",
      properties: {
        limit: 50,
        synced: result.synced,
        failed: result.failed,
        duration_ms: Date.now() - startedAt,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    await trackServerEvent({
      name: "cron_purchase_reconcile_failed",
      properties: {
        limit: 50,
        duration_ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    throw error;
  }
}
