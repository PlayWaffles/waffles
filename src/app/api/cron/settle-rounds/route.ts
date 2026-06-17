import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { settleClosedRounds } from "@/lib/v2/rounds";

export const maxDuration = 60;

/**
 * Settles v2 hourly tournament rounds that have closed: ranks entrants, pays
 * prizes to the Prize Wallet. Idempotent — safe to run on a schedule.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("Authorization") !== `Bearer ${env.partykitSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await settleClosedRounds();
  return NextResponse.json(result);
}
