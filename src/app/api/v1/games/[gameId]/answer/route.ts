import { NextRequest, NextResponse } from "next/server";

import { withAuth, type ApiError } from "@/lib/auth";
import { submitAnswerForAuthenticatedUser } from "@/actions/game";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";

interface AnswerBody {
  questionId?: string;
  selectedIndex?: number | null;
  timeTakenMs?: number;
}

export const POST = withAuth(async (request: NextRequest, auth, params) => {
  try {
    const body = (await request.json()) as AnswerBody;
    await trackServerEvent({
      name: "legacy_game_answer_submitted",
      userId: auth.userId,
      properties: {
        game_id_hash: hashServerAnalyticsId(params.gameId),
        question_id_hash: hashServerAnalyticsId(body.questionId),
        selected_index: typeof body.selectedIndex === "number" ? body.selectedIndex : null,
        response_ms: body.timeTakenMs,
      },
    });

    if (
      !body.questionId ||
      typeof body.timeTakenMs !== "number" ||
      (typeof body.selectedIndex !== "number" && body.selectedIndex !== null)
    ) {
      await trackServerEvent({
        name: "legacy_game_answer_rejected",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          question_id_hash: hashServerAnalyticsId(body.questionId),
          reason: "invalid_input",
        },
      });
      return NextResponse.json<ApiError>(
        { error: "Missing required fields", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const result = await submitAnswerForAuthenticatedUser(auth.userId, {
      gameId: params.gameId,
      questionId: body.questionId,
      selectedIndex: body.selectedIndex,
      timeTakenMs: body.timeTakenMs,
    });

    if (!result.success) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "INVALID_INPUT" || result.code === "INVALID_QUESTION"
            ? 400
            : result.code === "NOT_STARTED" ||
                result.code === "GAME_ENDED" ||
                result.code === "NOT_IN_GAME" ||
                result.code === "TICKET_REQUIRED" ||
                result.code === "LEFT_GAME"
              ? 409
              : 500;

      await trackServerEvent({
        name: "legacy_game_answer_rejected",
        userId: auth.userId,
        properties: {
          game_id_hash: hashServerAnalyticsId(params.gameId),
          question_id_hash: hashServerAnalyticsId(body.questionId),
          reason: result.code,
        },
      });

      return NextResponse.json<ApiError>(
        { error: result.error, code: result.code },
        { status },
      );
    }

    await trackServerEvent({
      name: "legacy_game_answer_result",
      userId: auth.userId,
      properties: {
        game_id_hash: hashServerAnalyticsId(params.gameId),
        question_id_hash: hashServerAnalyticsId(body.questionId),
        selected_index: typeof body.selectedIndex === "number" ? body.selectedIndex : null,
        response_ms: body.timeTakenMs,
        success: true,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/v1/games/[gameId]/answer Error:", error);
    await trackServerEvent({
      name: "legacy_game_answer_rejected",
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
