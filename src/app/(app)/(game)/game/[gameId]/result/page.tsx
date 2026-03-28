import { cache } from "react";
import { Metadata } from "next";
import { prisma } from "@/lib/db";
import ResultPageClient from "./client";
import { buildPrizeOGUrl, buildScoreOGUrl } from "@/lib/og";
import { resolveRuntimePlatform } from "@/lib/platform/server";

interface ResultPageProps {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Fetch game info
const getGame = cache(async (gameId: string, platform: "FARCASTER" | "MINIPAY") => {
  return prisma.game.findFirst({
    where: { id: gameId, platform },
  });
});

// Fetch top 3 entries for leaderboard display
const getTop3Entries = cache(async (gameId: string, platform: "FARCASTER" | "MINIPAY") => {
  return prisma.gameEntry.findMany({
    where: { gameId, game: { platform } },
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
  const prizeAmount = parseInt((sParams.prizeAmount as string) || "0", 10);
  const score = parseInt((sParams.score as string) || "0", 10);
  const pfpUrl = sParams.pfpUrl as string | undefined;
  const gameNumber = game.gameNumber;
  const category = game.theme || "Trivia";
  const rank = sParams.rank ? parseInt(sParams.rank as string, 10) : undefined;

  // Build OG image URL based on context
  let imageUrl: string | null = null;
  if (prizeAmount > 0) {
    // Prize winner - use prize OG
    imageUrl = buildPrizeOGUrl({ prizeAmount, pfpUrl });
  } else if (score > 0) {
    // Score share - use score OG
    imageUrl = buildScoreOGUrl({ score, username, gameNumber, category, rank, pfpUrl });
  }


  // Metadata based on context
  const title = prizeAmount > 0
    ? `${username} won on Waffles!`
    : score > 0
      ? `${username} scored ${score.toLocaleString()} pts on Waffles!`
      : `Game Results | ${game.title || game.theme}`;
  const description = prizeAmount > 0
    ? `${username} just won $${prizeAmount.toLocaleString()} on Waffles!`
    : score > 0
      ? `${username} scored ${score.toLocaleString()} points on Waffles!`
      : `Check out the results for ${game.title || game.theme}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [imageUrl] : [],
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
