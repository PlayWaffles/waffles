import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthResult, type ApiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { gameWhere } from "@/lib/platform/query";
import { z } from "zod";

type Params = { gameId: string };

interface ChatMessage {
  id: string;
  text: string;
  createdAt: Date;
  user: {
    id: string;
    username: string | null;
    pfpUrl: string | null;
  };
}

const sendMessageSchema = z.object({
  text: z.string().min(1).max(500),
});

/**
 * GET /api/v1/games/[gameId]/chat
 * Get chat messages for a game (public endpoint)
 * Query params:
 *   - limit: max messages (default 50)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  try {
    const { gameId } = await context.params;

    if (!gameId) {
      return NextResponse.json(
        { error: "Invalid game ID", code: "INVALID_PARAM" },
        { status: 400 }
      );
    }

    const platform = await resolveRuntimePlatform(request);

    const game = await prisma.game.findFirst({
      where: { id: gameId, ...gameWhere(platform) },
      select: { id: true },
    });

    if (!game) {
      return NextResponse.json(
        { error: "Game not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );

    const messages = await prisma.chat.findMany({
      where: { gameId: gameId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pfpUrl: true,
          },
        },
      },
    });

    // Reverse to show oldest first (chronological order)
    const response: ChatMessage[] = messages.reverse().map((m) => ({
      id: m.id,
      text: m.text,
      createdAt: m.createdAt,
      user: m.user,
    }));

    return NextResponse.json({ messages: response });
  } catch (error) {
    console.error("GET /api/v1/games/[gameId]/chat Error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/games/[gameId]/chat
 * Send a chat message (auth required)
 */
export const POST = withAuth<Params>(
  async (request, auth: AuthResult, params) => {
    try {
      const gameId = params.gameId;

      if (!gameId) {
        return NextResponse.json<ApiError>(
          { error: "Invalid game ID", code: "INVALID_PARAM" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const validation = sendMessageSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json<ApiError>(
          {
            error: validation.error.issues[0]?.message || "Invalid input",
            code: "VALIDATION_ERROR",
          },
          { status: 400 }
        );
      }

      const game = await prisma.game.findFirst({
        where: { id: gameId, ...gameWhere(auth.platform) },
        select: { id: true },
      });

      if (!game) {
        return NextResponse.json<ApiError>(
          { error: "Game not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }

      const message = await prisma.chat.create({
        data: {
          gameId: gameId,
          userId: auth.userId,
          text: validation.data.text,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              pfpUrl: true,
            },
          },
        },
      });

      const response: ChatMessage = {
        id: message.id,
        text: message.text,
        createdAt: message.createdAt,
        user: message.user,
      };

      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      console.error("POST /api/v1/games/[gameId]/chat Error:", error);
      return NextResponse.json<ApiError>(
        { error: "Internal server error", code: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  }
);
