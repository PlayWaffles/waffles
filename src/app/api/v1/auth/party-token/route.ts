import { NextResponse } from "next/server";
import { withAuth, type AuthResult, type ApiError } from "@/lib/auth";
import { SignJWT } from "jose";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request, auth: AuthResult) => {
  const secret = env.partykitSecret;
  if (!secret) {
    return NextResponse.json<ApiError>(
      { error: "Server configuration error", code: "CONFIG_ERROR" },
      { status: 500 },
    );
  }

  const token = await new SignJWT({
    userId: auth.userId,
    platform: auth.platform,
    fid: auth.fid,
    address: auth.address,
    username: auth.username,
    pfpUrl: auth.pfpUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token });
});
