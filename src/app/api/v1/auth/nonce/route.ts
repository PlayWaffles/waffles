import { NextResponse } from "next/server";

import { createNonce, type ApiError } from "@/lib/auth";
import { resolveRuntimePlatform } from "@/lib/platform/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json<ApiError>(
        { error: "Address is required", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const platform = await resolveRuntimePlatform(request);
    const nonce = await createNonce(address, platform);
    return NextResponse.json(nonce);
  } catch (error) {
    console.error("GET /api/v1/auth/nonce Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Failed to create nonce", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
