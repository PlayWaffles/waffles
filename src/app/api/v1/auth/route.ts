import { NextResponse } from "next/server";

import { getAuthFromRequest, type ApiError } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth) {
      return NextResponse.json<ApiError>(
        { error: "Not authenticated", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      authenticated: true,
      userId: auth.userId,
      platform: auth.platform,
      fid: auth.fid ?? null,
      address: auth.address ?? null,
      username: auth.username ?? null,
      pfpUrl: auth.pfpUrl ?? null,
    });
  } catch (error) {
    console.error("GET /api/v1/auth Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
