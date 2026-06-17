import { NextResponse } from "next/server";
import { withAuth, type AuthResult, type ApiError } from "@/lib/auth";
import { SignJWT } from "jose";
import { env } from "@/lib/env";
import { trackServerEvent } from "@/lib/server-analytics";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request, auth: AuthResult) => {
  const secret = env.partykitSecret;
  if (!secret) {
    await trackServerEvent({
      name: "api_party_token_requested",
      userId: auth.userId,
      properties: {
        result: "config_error",
        platform: auth.platform,
      },
    });
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

  await trackServerEvent({
    name: "api_party_token_requested",
    userId: auth.userId,
    properties: {
      result: "issued",
      platform: auth.platform,
    },
  });
  return NextResponse.json({ token });
});
