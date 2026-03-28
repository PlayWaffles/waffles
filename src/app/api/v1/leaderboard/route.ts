import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { z } from "zod";
import { UserPlatform } from "@prisma";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { entryWhere, gameWhere } from "@/lib/platform/query";

// ============================================
// CONFIGURATION
// ============================================
const PAGE_SIZE = env.nextPublicLeaderboardPageSize;

// ============================================
// TYPES
// ============================================
interface LeaderboardEntry {
  id: string;
  userId: string;
  fid: number | null;
  wallet?: string | null;
  rank: number;
  username: string | null;
  prize: number;
  score?: number;
  pfpUrl: string | null;
}

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  hasMore: boolean;
  totalPlayers: number;
  gameTitle?: string;
  gameNumber?: number;
}

// ============================================
// QUERY VALIDATION
// ============================================
const querySchema = z.object({
  tab: z.enum(["allTime"]).optional(),
  page: z.coerce.number().int().nonnegative().default(0),
  gameId: z.string().optional(),
});

// ============================================
// HANDLER
// ============================================
export async function GET(request: NextRequest) {
  try {
    const platform = await resolveRuntimePlatform(request);
    // 1. Parse params
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      tab: searchParams.get("tab") || undefined,
      page: searchParams.get("page") || "0",
      gameId: searchParams.get("gameId") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 }
      );
    }

    const { tab, page, gameId } = parsed.data;

    // 2. Route to appropriate handler
    if (tab === "allTime") {
      return handleAllTime(page, platform);
    }
    return handleGame(page, platform, gameId);
  } catch (error) {
    console.error("GET /api/v1/leaderboard Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// ALL TIME HANDLER
// ============================================
async function handleAllTime(
  page: number,
  platform: UserPlatform,
): Promise<NextResponse<LeaderboardResponse>> {
  const [aggregated, countResult] = await Promise.all([
    prisma.gameEntry.groupBy({
      by: ["userId"],
      where: entryWhere(platform),
      _sum: { prize: true },
      orderBy: { _sum: { prize: "desc" } },
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "userId") as count
      FROM "GameEntry" ge
      JOIN "Game" g ON ge."gameId" = g.id
      WHERE g.platform = ${platform}::"UserPlatform"
    `,
  ]);

  const totalPlayers = Number(countResult[0]?.count ?? 0);

  if (aggregated.length === 0) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
    });
  }

  const userIds = aggregated.map((a) => a.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fid: true, wallet: true, username: true, pfpUrl: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const entries: LeaderboardEntry[] = aggregated.map((a, i) => {
    const user = userMap.get(a.userId);
    return {
      id: user?.id ?? a.userId,
      userId: user?.id ?? a.userId,
      fid: user?.fid ?? null,
      wallet: user?.wallet ?? null,
      rank: page * PAGE_SIZE + i + 1,
      username: user?.username ?? "Unknown",
      prize: a._sum?.prize ?? 0,
      pfpUrl: user?.pfpUrl ?? null,
    };
  });

  return NextResponse.json({
    entries,
    hasMore: (page + 1) * PAGE_SIZE < totalPlayers,
    totalPlayers,
  });
}

// ============================================
// GAME HANDLER
// ============================================
async function handleGame(
  page: number,
  platform: UserPlatform,
  gameId?: string
): Promise<NextResponse<LeaderboardResponse>> {
  // Resolve game ID - use provided or get latest
  let targetGameId = gameId;

  if (!targetGameId) {
    const latest = await prisma.game.findFirst({
      where: gameWhere(platform),
      orderBy: { endsAt: "desc" },
      select: { id: true },
    });
    targetGameId = latest?.id;
  }

  if (!targetGameId) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
    });
  }

  const game = await prisma.game.findUnique({
    where: { id: targetGameId },
    select: { title: true, gameNumber: true, platform: true },
  });

  if (!game || game.platform !== platform) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
    });
  }

  const [players, total] = await prisma.$transaction([
    prisma.gameEntry.findMany({
      where: {
        gameId: targetGameId,
      },
      select: {
        prize: true,
        score: true,
        user: {
          select: {
            id: true,
            fid: true,
            wallet: true,
            username: true,
            pfpUrl: true,
          },
        },
      },
      orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
    prisma.gameEntry.count({
      where: {
        gameId: targetGameId,
      },
    }),
  ]);

  if (players.length === 0) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
      gameTitle: game?.title ?? "Game",
      gameNumber: game?.gameNumber ?? 1,
    });
  }

  const entries: LeaderboardEntry[] = players.map((p, i) => ({
    id: p.user.id,
    userId: p.user.id,
    fid: p.user.fid,
    wallet: p.user.wallet,
    rank: page * PAGE_SIZE + i + 1,
    username: p.user.username,
    prize: p.prize ?? 0,
    score: p.score,
    pfpUrl: p.user.pfpUrl,
  }));

  return NextResponse.json({
    entries,
    hasMore: (page + 1) * PAGE_SIZE < total,
    totalPlayers: total,
    gameTitle: game?.title ?? "Game",
    gameNumber: game?.gameNumber ?? undefined,
  });
}
