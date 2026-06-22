import { NextResponse } from "next/server";

import { createNonce, type ApiError } from "@/lib/auth";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { trackServerEvent } from "@/lib/server-analytics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      await trackServerEvent({
        name: "api_auth_nonce_requested",
        properties: {
          result: "invalid_input",
          reason: "missing_address",
        },
      });
      return NextResponse.json<ApiError>(
        { error: "Address is required", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const platform = await resolveRuntimePlatform(request);
    const nonce = await createNonce(address);
    await trackServerEvent({
      name: "api_auth_nonce_requested",
      properties: {
        result: "created",
        platform,
        wallet_connected: true,
      },
    });
    return NextResponse.json(nonce);
  } catch (error) {
    console.error("GET /api/v1/auth/nonce Error:", error);
    await trackServerEvent({
      name: "api_auth_nonce_requested",
      properties: {
        result: "failed",
        reason: error instanceof Error ? error.message : "nonce_failed",
      },
    });
    return NextResponse.json<ApiError>(
      { error: "Failed to create nonce", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
