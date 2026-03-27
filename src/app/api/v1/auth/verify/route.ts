import { NextResponse } from "next/server";

import { verifyWalletSignature, type ApiError } from "@/lib/auth";

interface VerifyBody {
  address?: string;
  signature?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyBody;
    if (!body.address || !body.signature) {
      return NextResponse.json<ApiError>(
        { error: "Address and signature are required", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const auth = await verifyWalletSignature(body.address, body.signature);
    if (!auth) {
      return NextResponse.json<ApiError>(
        { error: "Invalid signature", code: "INVALID_SIGNATURE" },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true, ...auth });
  } catch (error) {
    console.error("POST /api/v1/auth/verify Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Verification failed", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
