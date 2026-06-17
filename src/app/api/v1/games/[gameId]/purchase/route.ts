import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  processPendingPurchaseByTxHash,
  registerPendingPurchase,
} from "@/lib/game/pending-purchases";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

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
  CHAIN_RPC_ERROR: 503,
  GAME_ENDED: 409,
  TICKETS_CLOSED: 409,
  GAME_FULL: 409,
  PRICE_CHANGED: 409,
};

function getPurchaseErrorStatus(code?: string) {
  return (code && PURCHASE_ERROR_STATUS[code]) || 500;
}

export const POST = withAuth(async (request: NextRequest, auth, params) => {
  try {
    const body = (await request.json()) as PurchaseBody;
    await trackServerEvent({
      name: "legacy_game_purchase_started",
      userId: auth.userId,
      properties: {
        game_id_hash: hashServerAnalyticsId(params.gameId),
        amount_usdt: body.paidAmount,
        tx_present: Boolean(body.txHash),
        wallet_connected: Boolean(body.payerWallet),
      },
    });

    if (!body.txHash || typeof body.paidAmount !== "number" || !body.payerWallet) {
      await trackServerEvent({
        name: "legacy_game_purchase_failed",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          tx_present: Boolean(body.txHash),
          wallet_connected: Boolean(body.payerWallet),
          reason: "invalid_input",
        },
      });
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
      await trackServerEvent({
        name: "legacy_game_purchase_failed",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          amount_usdt: body.paidAmount,
          reason: "user_not_found",
        },
      });
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
      await trackServerEvent({
        name: "legacy_game_purchase_failed",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          amount_usdt: body.paidAmount,
          reason: registration.code,
        },
      });
      return NextResponse.json<ApiError>(
        { error: registration.error, code: registration.code },
        { status: 400 },
      );
    }

    const result = await processPendingPurchaseByTxHash(body.txHash);

    if (!result.success) {
      await trackServerEvent({
        name: "legacy_game_purchase_failed",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          amount_usdt: body.paidAmount,
          reason: result.code,
        },
      });
      return NextResponse.json<ApiError>(
        { error: result.error, code: result.code },
        { status: getPurchaseErrorStatus(result.code) },
      );
    }

    await trackServerEvent({
      name: "legacy_game_purchase_succeeded",
      userId: auth.userId,
      properties: {
        game_id_hash: hashServerAnalyticsId(params.gameId),
        amount_usdt: body.paidAmount,
        tx_present: true,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/games/[gameId]/purchase Error:", error);
    await trackServerEvent({
      name: "legacy_game_purchase_failed",
      userId: auth.userId,
      properties: {
        game_id_hash: hashServerAnalyticsId(params.gameId),
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
