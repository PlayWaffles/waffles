import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { claimFreeTicketForAuthenticatedUser } from "@/actions/game";

export const POST = withAuth(async (_request: NextRequest, auth, params) => {
  try {
    const result = await claimFreeTicketForAuthenticatedUser(
      auth.userId,
      params.gameId,
    );

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "WRONG_PLATFORM"
            ? 403
            : result.code === "INVALID_INPUT"
              ? 400
              : result.code === "GAME_ENDED" ||
                  result.code === "GAME_FULL" ||
                  result.code === "TICKETS_CLOSED"
                ? 409
                : 500;

      return NextResponse.json<ApiError>(
        { error: result.error, code: result.code },
        { status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/games/[gameId]/free-ticket Error:", error);
    return NextResponse.json<ApiError>(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
});
