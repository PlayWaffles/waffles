import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { processPendingPurchases } from "@/lib/game/pending-purchases";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (request.headers.get("Authorization") !== `Bearer ${env.partykitSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingPurchases(50);
  return NextResponse.json(result);
}
