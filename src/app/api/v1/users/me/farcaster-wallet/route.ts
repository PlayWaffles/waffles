import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { syncFarcasterWalletAndRecoverForUser } from "@/actions/users";

interface SyncWalletBody {
  wallet?: string;
  username?: string | null;
}

export const POST = withAuth(async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as SyncWalletBody;

    if (!body.wallet) {
      return NextResponse.json<ApiError>(
        { error: "Wallet is required", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const result = await syncFarcasterWalletAndRecoverForUser(
      auth.userId,
      body.wallet,
      body.username ?? null,
    );

    if (!result.success) {
      const status =
        result.error === "Only Farcaster users can use this sync"
          ? 403
          : result.error === "Invalid wallet address" ||
              result.error === "This wallet is already linked to another user"
            ? 400
            : 500;

      return NextResponse.json<ApiError>(
        { error: result.error, code: "SYNC_FAILED" },
        { status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/users/me/farcaster-wallet Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
