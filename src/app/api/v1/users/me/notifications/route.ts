import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const bodySchema = z.object({
  token: z.string().min(1),
  url: z.string().url(),
});

/**
 * Decode the app owner FID from the account-association payload.
 * The payload is a base64url-encoded JSON string: { fid: number, ... }
 */
function getAppFid(): number | null {
  const raw = env.accountAssociation.payload;
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    return typeof json.fid === "number" ? json.fid : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/v1/users/me/notifications
 *
 * Client-side fallback for saving Farcaster notification tokens.
 * Called when the miniAppAdded SDK event fires with notificationDetails,
 * in case the server-to-server webhook was missed or delayed.
 */
export const POST = withAuth(async (request: NextRequest, auth) => {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<ApiError>(
        { error: "Invalid body", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { fid: true, platform: true },
    });

    if (!user || user.platform !== "FARCASTER" || !user.fid) {
      return NextResponse.json<ApiError>(
        { error: "Not a Farcaster user", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const appFid = getAppFid();
    if (!appFid) {
      console.error("[notifications] Cannot decode appFid from account association payload");
      return NextResponse.json<ApiError>(
        { error: "Server configuration error", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }

    await prisma.notificationToken.upsert({
      where: { userId_appFid: { userId: auth.userId, appFid } },
      update: {
        token: parsed.data.token,
        url: parsed.data.url,
        updatedAt: new Date(),
      },
      create: {
        userId: auth.userId,
        appFid,
        token: parsed.data.token,
        url: parsed.data.url,
      },
    });

    console.log("[notifications] Token saved via client fallback:", {
      userId: auth.userId,
      fid: user.fid,
      appFid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/v1/users/me/notifications Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
