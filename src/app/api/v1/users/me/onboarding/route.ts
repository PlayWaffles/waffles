import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  completedAt: z.string().datetime().optional(),
});

export const POST = withAuth(async (request: NextRequest, auth) => {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json<ApiError>(
        { error: "Invalid body", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const completedAt = parsed.data.completedAt
      ? new Date(parsed.data.completedAt)
      : new Date();

    await prisma.user.updateMany({
      where: {
        id: auth.userId,
        onboardingCompletedAt: null,
      },
      data: {
        onboardingCompletedAt: completedAt,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("POST /api/v1/users/me/onboarding Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
