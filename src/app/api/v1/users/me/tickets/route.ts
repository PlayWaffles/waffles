import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { entryWhere } from "@/lib/platform/query";
import { getGamePhase } from "@/lib/types";

export const GET = withAuth(async (request: NextRequest, auth) => {
  try {
    const { searchParams } = new URL(request.url);
    const gameIdParam = searchParams.get("gameId");
    const entries = await prisma.gameEntry.findMany({
      where: {
        userId: auth.userId,
        ...entryWhere(auth.platform),
        ...(gameIdParam ? { gameId: gameIdParam } : {}),
      },
      include: {
        game: {
          select: {
            id: true,
            platform: true,
            startsAt: true,
            endsAt: true,
            tierPrices: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      entries.map((entry) => ({
        id: entry.id,
        status:
          entry.purchaseSource === "FREE_ADMIN" ||
          entry.purchaseSource === "FREE_PLAYER"
            ? "FREE"
            : entry.paidAt
              ? "PAID"
              : "PENDING",
        purchaseSource: entry.purchaseSource,
        amountUSDC: entry.paidAmount ?? 0,
        gameId: entry.gameId,
        paidAt: entry.paidAt,
        createdAt: entry.createdAt,
        score: entry.score,
        answered: entry.answered,
        game: {
          id: entry.gameId,
          platform: entry.game.platform,
          startsAt: entry.game.startsAt,
          endsAt: entry.game.endsAt,
          status: getGamePhase(entry.game),
          ticketPrice: entry.paidAmount ?? 0,
        },
      })),
    );
  } catch (error) {
    console.error("GET /api/v1/users/me/tickets Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
