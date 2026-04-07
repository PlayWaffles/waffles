import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { z } from "zod";
import { Prisma, UserPlatform } from "@prisma";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import {
  entryWhere,
  gameWhere,
  isGameVisibleToPlatform,
  sharesBaseMainnetGames,
} from "@/lib/platform/query";

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
  prevGameId?: string;
  nextGameId?: string;
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
  const offset = page * PAGE_SIZE;
  const allTimeWhere = sharesBaseMainnetGames(platform)
    ? Prisma.sql`g.platform IN ('FARCASTER'::"UserPlatform", 'BASE_APP'::"UserPlatform") AND g."isTestnet" = false`
    : Prisma.sql`g.platform = ${platform}::"UserPlatform"`;
  const [rankedRows, countResult] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string;
      userId: string;
      fid: number | null;
      wallet: string | null;
      username: string | null;
      pfpUrl: string | null;
      prize: number | null;
      rank: bigint;
    }>>`
      WITH leaderboard AS (
        SELECT
          u.id,
          u.id AS "userId",
          u.fid,
          u.wallet,
          u.username,
          u."pfpUrl",
          COALESCE(SUM(ge.prize), 0) AS prize,
          ROW_NUMBER() OVER (
            ORDER BY
              COALESCE(SUM(ge.prize), 0) DESC,
              COUNT(*) FILTER (WHERE COALESCE(ge.prize, 0) > 0) DESC,
              COALESCE(u.username, '') ASC,
              u.id ASC
          ) AS rank
        FROM "GameEntry" ge
        JOIN "Game" g ON ge."gameId" = g.id
        JOIN "User" u ON ge."userId" = u.id
        WHERE ${allTimeWhere}
        GROUP BY u.id, u.fid, u.wallet, u.username, u."pfpUrl"
      )
      SELECT *
      FROM leaderboard
      ORDER BY rank ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT ge."userId") as count
      FROM "GameEntry" ge
      JOIN "Game" g ON ge."gameId" = g.id
      WHERE ${allTimeWhere}
    `,
  ]);

  const totalPlayers = Number(countResult[0]?.count ?? 0);

  if (rankedRows.length === 0) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
    });
  }

  const entries: LeaderboardEntry[] = rankedRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    fid: row.fid,
    wallet: row.wallet,
    rank: Number(row.rank),
    username: row.username ?? "Unknown",
    prize: row.prize ?? 0,
    pfpUrl: row.pfpUrl,
  }));

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
    select: { title: true, gameNumber: true, platform: true, isTestnet: true, endsAt: true },
  });

  if (!game || !isGameVisibleToPlatform(game, platform)) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
    });
  }

  // Fetch adjacent games for prev/next navigation
  const platformGamesWhere = gameWhere(platform);
  const [prevGame, nextGame] = await Promise.all([
    prisma.game.findFirst({
      where: {
        ...platformGamesWhere,
        endsAt: { lt: game.endsAt! },
      },
      orderBy: { endsAt: "desc" },
      select: { id: true },
    }),
    prisma.game.findFirst({
      where: {
        ...platformGamesWhere,
        endsAt: { gt: game.endsAt! },
      },
      orderBy: { endsAt: "asc" },
      select: { id: true },
    }),
  ]);

  const scoreFilter = { gameId: targetGameId, score: { gt: 0 } };

  const [players, total] = await prisma.$transaction([
    prisma.gameEntry.findMany({
      where: scoreFilter,
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
      where: scoreFilter,
    }),
  ]);

  if (players.length === 0) {
    return NextResponse.json({
      entries: [],
      hasMore: false,
      totalPlayers: 0,
      gameTitle: game?.title ?? "Game",
      gameNumber: game?.gameNumber ?? 1,
      prevGameId: prevGame?.id,
      nextGameId: nextGame?.id,
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
    prevGameId: prevGame?.id,
    nextGameId: nextGame?.id,
  });
}
