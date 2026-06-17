import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";

export const POST = withAuth(async (_request: NextRequest, _auth, _params) => {
  return NextResponse.json<ApiError>(
    { error: "Free tickets are no longer available", code: "FREE_TICKETS_DISABLED" },
    { status: 410 },
  );
});
