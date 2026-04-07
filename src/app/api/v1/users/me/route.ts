import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = withAuth(async (_request: NextRequest, auth) => {
  try {
    const [user, freeTicketEntry] = await Promise.all([
      prisma.user.findUnique({
        where: { id: auth.userId },
        select: {
          id: true,
          platform: true,
          fid: true,
          username: true,
          pfpUrl: true,
          wallet: true,
          _count: {
            select: { referrals: true, notifs: true },
          },
          inviteQuota: true,
          inviteCode: true,
          hasGameAccess: true,
          isBanned: true,
          createdAt: true,
        },
      }),
      prisma.gameEntry.findFirst({
        where: {
          userId: auth.userId,
          purchaseSource: "FREE_PLAYER",
          answered: { gt: 0 },
        },
        select: { id: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: user.id,
      platform: user.platform,
      fid: user.fid,
      username: user.username,
      pfpUrl: user.pfpUrl,
      wallet: user.wallet,
      notificationsEnabled:
        user.platform === "FARCASTER" ? user._count.notifs > 0 : false,
      inviteQuota: user.inviteQuota,
      inviteCode: user.inviteCode,
      hasGameAccess: user.hasGameAccess,
      isBanned: user.isBanned,
      createdAt: user.createdAt,
      invitesCount: user._count.referrals,
      hasUsedFreeTicket: !!freeTicketEntry,
    });
  } catch (error) {
    console.error("GET /api/v1/users/me Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
