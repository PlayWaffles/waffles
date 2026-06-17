import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

export const POST = withAuth(async (_request: NextRequest, auth, params) => {
  await trackServerEvent({
    name: "legacy_game_free_ticket_rejected",
    userId: auth.userId,
    properties: {
      game_id_hash: hashServerAnalyticsId(params.gameId),
      reason: "disabled",
    },
  });
  return NextResponse.json<ApiError>(
    { error: "Free tickets are no longer available", code: "FREE_TICKETS_DISABLED" },
    { status: 410 },
  );
});
