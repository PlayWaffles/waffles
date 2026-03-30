import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { finalizeTicketPurchase } from "@/lib/game/purchase";

interface PurchaseBody {
  txHash?: string;
  paidAmount?: number;
  payerWallet?: string;
}

export const POST = withAuth(async (request: NextRequest, auth, params) => {
  try {
    const body = (await request.json()) as PurchaseBody;

    if (!body.txHash || typeof body.paidAmount !== "number" || !body.payerWallet) {
      return NextResponse.json<ApiError>(
        { error: "Missing required fields", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        platform: true,
        username: true,
        pfpUrl: true,
        wallet: true,
      },
    });

    if (!user) {
      return NextResponse.json<ApiError>(
        { error: "User not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const result = await finalizeTicketPurchase(user, {
      gameId: params.gameId,
      txHash: body.txHash,
      paidAmount: body.paidAmount,
      payerWallet: body.payerWallet,
    });

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "WRONG_PLATFORM"
            ? 403
            : result.code === "INVALID_INPUT"
              ? 400
              : result.code === "VERIFICATION_FAILED"
                ? 422
                : result.code === "GAME_ENDED" ||
                    result.code === "GAME_FULL" ||
                    result.code === "PRICE_CHANGED"
                  ? 409
                  : 500;

      return NextResponse.json<ApiError>(
        { error: result.error, code: result.code },
        { status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/games/[gameId]/purchase Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
