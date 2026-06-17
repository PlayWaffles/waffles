import { NextResponse } from "next/server";

import { verifyWalletSignature, type ApiError } from "@/lib/auth";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { trackServerEvent } from "@/lib/server-analytics";

interface VerifyBody {
  address?: string;
  signature?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyBody;
    if (!body.address || !body.signature) {
      await trackServerEvent({
        name: "api_auth_verify_failed",
        properties: {
          reason: "invalid_input",
          wallet_connected: Boolean(body.address),
        },
      });
      return NextResponse.json<ApiError>(
        { error: "Address and signature are required", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const platform = await resolveRuntimePlatform(request);
    const auth = await verifyWalletSignature(body.address, body.signature, platform);
    if (!auth) {
      await trackServerEvent({
        name: "api_auth_verify_failed",
        properties: {
          reason: "invalid_signature",
          platform,
          wallet_connected: true,
        },
      });
      return NextResponse.json<ApiError>(
        { error: "Invalid signature", code: "INVALID_SIGNATURE" },
        { status: 401 },
      );
    }

    await trackServerEvent({
      name: "api_auth_verify_succeeded",
      userId: auth.userId,
      properties: {
        platform,
        wallet_connected: true,
      },
    });
    return NextResponse.json({ success: true, ...auth });
  } catch (error) {
    console.error("POST /api/v1/auth/verify Error:", error);
    await trackServerEvent({
      name: "api_auth_verify_failed",
      properties: {
        reason: error instanceof Error ? error.message : "verify_failed",
      },
    });
    return NextResponse.json<ApiError>(
      { error: "Verification failed", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
