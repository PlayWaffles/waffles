import { cache } from "react";
import { redirect } from "next/navigation";
import type { UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { getGamePhase } from "@/lib/types";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { resolveRuntimePlatform } from "@/lib/platform/server";
import { gameWhere } from "@/lib/platform/query";
import LiveGameScreen from "./LiveGameScreen";

export const dynamic = "force-dynamic";

// ==========================================
// TYPES (exported for LiveGameScreen)
// ==========================================

export interface LiveGameQuestion {
  id: string;

  content: string;
  mediaUrl: string | null;
  soundUrl: string | null;
  options: string[];
  correctIndex: number;
  durationSec: number;
  points: number;
  roundIndex: number;
  orderInRound: number;
}

export interface LiveGameData {
  id: string;
  gameNumber: number;
  endsAt: Date;
  roundBreakSec: number;
  prizePool: number;
  theme: string;
  questions: LiveGameQuestion[];
}

// ==========================================
// DATA FETCHING
// ==========================================

const getGame = cache(async (gameId: string, platform: UserPlatform) => {
  const game = await prisma.game.findFirst({
    where: { id: gameId, ...gameWhere(platform) },
    select: {
      id: true,
      gameNumber: true,
      startsAt: true,
      endsAt: true,
      roundBreakSec: true,
      prizePool: true,
      theme: true,
      questions: {
        select: {
          id: true,
          content: true,
          mediaUrl: true,
          soundUrl: true,
          options: true,
          correctIndex: true,
          durationSec: true,
          points: true,
          roundIndex: true,
          orderInRound: true,
        },
        orderBy: [{ roundIndex: "asc" }, { orderInRound: "asc" }],
      },
    },
  });

  if (!game) return null;

  // Check if game is live
  const phase = getGamePhase(game);
  if (phase !== "LIVE") {
    return null;
  }

  return {
    id: game.id,
    gameNumber: game.gameNumber,
    endsAt: game.endsAt,
    roundBreakSec: game.roundBreakSec,
    prizePool: game.prizePool,
    theme: game.theme,
    questions: game.questions.map((q) => ({
      ...q,
      durationSec: q.durationSec ?? 10,
    })),
  } satisfies LiveGameData;
});

// ==========================================
// PAGE COMPONENT
// ==========================================

export default async function LiveGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const platform = await resolveRuntimePlatform();

  const game = await getGame(gameId, platform);

  // If game doesn't exist or is not live, redirect to game hub
  if (!game) {
    redirect("/game");
  }

  return (
    <RealtimeProvider gameId={gameId}>
      <LiveGameScreen game={game} />
    </RealtimeProvider>
  );
}
