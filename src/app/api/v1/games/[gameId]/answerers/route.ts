import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth, type ApiError } from "@/lib/auth";

/**
 * GET /api/v1/games/:gameId/answerers?questionId=xxx
 *
 * Returns the newest-first list of players who answered a specific question,
 * ordered by updatedAt (approximation of answer time).
 * Used to backfill the answerer PFP stack on question load.
 */
export const GET = withAuth(async (request: NextRequest, auth, params) => {
  const questionId = request.nextUrl.searchParams.get("questionId");
  if (!questionId) {
    return NextResponse.json<ApiError>(
      { error: "questionId is required", code: "INVALID_INPUT" },
      { status: 400 },
    );
  }

  const answerers = await prisma.gameEntry.findMany({
    where: {
      gameId: params.gameId,
      leftAt: null,
      answers: {
        path: [questionId],
        not: { equals: null },
      },
      // Exclude the requesting user — they see their own state separately
      userId: { not: auth.userId },
    },
    select: {
      updatedAt: true,
      answers: true,
      user: {
        select: {
          username: true,
          pfpUrl: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    answerers.map((e) => {
      const answers = e.answers as Record<string, { correct?: boolean }> | null;
      const answer = answers?.[questionId];

      return {
        username: e.user.username ?? "anon",
        pfpUrl: e.user.pfpUrl,
        correct: typeof answer?.correct === "boolean" ? answer.correct : null,
      };
    }),
  );
});
