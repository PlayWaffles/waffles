import { cache } from "react";
import { Metadata } from "next";
import { prisma } from "@/lib/db";
import ResultPageClient from "./client";
import { buildJoinedOGUrl, buildPrizeOGUrl, buildScoreOGUrl } from "@/lib/og";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { gameWhere } from "@/lib/platform/query";
import { buildMiniAppEmbed } from "@/lib/farcaster";
import { env } from "@/lib/env";

interface ResultPageProps {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Fetch game info
const getGame = cache(async (gameId: string, platform: "FARCASTER" | "MINIPAY") => {
  return prisma.game.findFirst({
    where: { id: gameId, ...gameWhere(platform) },
  });
});

// Fetch top 3 entries for leaderboard display
const getTop3Entries = cache(async (gameId: string, platform: "FARCASTER" | "MINIPAY") => {
  return prisma.gameEntry.findMany({
    where: { gameId, game: gameWhere(platform) },
    orderBy: { score: "desc" },
    take: 3,
    select: {
      score: true,
      rank: true,
      user: {
        select: { fid: true, wallet: true, username: true, pfpUrl: true },
      },
    },
  });
});

export async function generateMetadata({
  params,
  searchParams,
}: ResultPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const sParams = await searchParams;
  const platform = await resolveRuntimePlatform();

  // Get game info
  const game = await getGame(gameId, platform);
  if (!game) {
    return { title: "Game Not Found" };
  }

  // Extract share params (passed when sharing)
  const username = (sParams.username as string) || "Player";
  const prizeAmountParam = sParams.prizeAmount as string | undefined;
  const scoreParam = sParams.score as string | undefined;
  const rankParam = sParams.rank as string | undefined;
  const prizeAmount = parseInt(prizeAmountParam || "0", 10);
  const score = parseInt(scoreParam || "0", 10);
  const pfpUrl = sParams.pfpUrl as string | undefined;
  const gameNumber = game.gameNumber;
  const category = game.theme || "Trivia";
  const rank = rankParam ? parseInt(rankParam, 10) : undefined;
  const hasResultShareParams =
    typeof prizeAmountParam === "string" ||
    typeof scoreParam === "string" ||
    typeof rankParam === "string";

  // Build OG image URL based on context
  let imageUrl: string | null = null;
  if (prizeAmount > 0) {
    // Prize winner - use prize OG
    imageUrl = buildPrizeOGUrl({ prizeAmount, pfpUrl });
  } else if (hasResultShareParams) {
    // Score share - use score OG
    imageUrl = buildScoreOGUrl({ score, username, gameNumber, category, rank, pfpUrl });
  } else {
    const themeImageUrl = game.coverUrl
      ? game.coverUrl.startsWith("http")
        ? game.coverUrl
        : `${env.rootUrl}${game.coverUrl}`
      : `${env.rootUrl}/logo.png`;

    imageUrl = buildJoinedOGUrl({
      username,
      prizePool: game.prizePool,
      theme: game.theme,
      pfpUrl,
      themeImageUrl,
    });
  }


  // Metadata based on context
  const title = prizeAmount > 0
    ? `${username} won on Waffles!`
    : hasResultShareParams
      ? `${username} scored ${score.toLocaleString()} pts on Waffles!`
      : `Game Results | ${game.title || game.theme}`;
  const description = prizeAmount > 0
    ? `${username} just won $${prizeAmount.toLocaleString()} on Waffles!`
    : hasResultShareParams
      ? `${username} scored ${score.toLocaleString()} points on Waffles!`
      : `Check out the results for ${game.title || game.theme}`;
  const pageUrl = `${env.rootUrl}/game/${gameId}/result`;
  const embed = buildMiniAppEmbed({
    imageUrl: imageUrl || `${env.rootUrl}/logo.png`,
    buttonTitle: "View Results",
    url: pageUrl,
  });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
    },
    other: {
      "fc:miniapp": JSON.stringify(embed),
    },
  };
}

export default async function ResultPage({
  params,
}: ResultPageProps) {
  const { gameId } = await params;
  const platform = await resolveRuntimePlatform();

  // Fetch data server-side in parallel
  const gamePromise = getGame(gameId, platform);
  const top3Promise = getTop3Entries(gameId, platform);

  // User-specific data (their result, rank) is fetched client-side with auth
  return <ResultPageClient gamePromise={gamePromise} top3Promise={top3Promise} />;
}
