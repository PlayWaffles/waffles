import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  processPendingPurchaseByTxHash,
  registerPendingPurchase,
} from "@/lib/game/pending-purchases";

interface PurchaseBody {
  txHash?: string;
  paidAmount?: number;
  payerWallet?: string;
}

const PURCHASE_ERROR_STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  WRONG_PLATFORM: 403,
  INVALID_INPUT: 400,
  VERIFICATION_FAILED: 422,
  GAME_ENDED: 409,
  GAME_FULL: 409,
  PRICE_CHANGED: 409,
};

function getPurchaseErrorStatus(code?: string) {
  return (code && PURCHASE_ERROR_STATUS[code]) || 500;
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

    const registration = await registerPendingPurchase({
      txHash: body.txHash,
      userId: user.id,
      gameId: params.gameId,
      platform: user.platform,
      payerWallet: body.payerWallet,
      expectedAmount: body.paidAmount,
    });

    if (!registration.success) {
      return NextResponse.json<ApiError>(
        { error: registration.error, code: registration.code },
        { status: 400 },
      );
    }

    const result = await processPendingPurchaseByTxHash(body.txHash);

    if (!result.success) {
      return NextResponse.json<ApiError>(
        { error: result.error, code: result.code },
        { status: getPurchaseErrorStatus(result.code) },
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
