import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserPlatform } from "@prisma";

const farcasterProfileSchema = z.object({
  fid: z.number().int().positive(),
  username: z.string().trim().min(1).optional().nullable(),
  pfpUrl: z.string().url().optional().nullable(),
});

export const POST = withAuth(async (request: NextRequest, auth) => {
  try {
    if (auth.platform !== UserPlatform.FARCASTER || !auth.fid) {
      return NextResponse.json<ApiError>(
        { error: "Only Farcaster users can sync this profile", code: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = farcasterProfileSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json<ApiError>(
        { error: body.error.issues[0]?.message || "Invalid input", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    if (body.data.fid !== auth.fid) {
      return NextResponse.json<ApiError>(
        { error: "Farcaster profile mismatch", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: {
        fid: body.data.fid,
        username: body.data.username ?? null,
        pfpUrl: body.data.pfpUrl ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/v1/users/me/farcaster-profile Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
