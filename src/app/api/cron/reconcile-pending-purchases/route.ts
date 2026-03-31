import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { safeRevalidateGamePaths } from "@/lib/game/cache";
import { processPendingPurchases } from "@/lib/game/pending-purchases";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (request.headers.get("Authorization") !== `Bearer ${env.partykitSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingPurchases(50);
  if (result.synced > 0) {
    safeRevalidateGamePaths("cron/reconcile-pending-purchases");
  }
  return NextResponse.json(result);
}
