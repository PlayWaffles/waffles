import { Metadata } from "next";
import { getCurrentOrNextGame, getLastGameWinners } from "@/lib/game";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { BottomNav } from "@/components/BottomNav";
import { resolveRuntimePlatform } from "@/lib/platform/server";

import { GameHub } from "./client";

// ==========================================
// METADATA
// ==========================================

export const metadata: Metadata = {
  title: "Waffles",
  description: "Guess the movie scene. Win real prizes.",
  other: {
    "base:app_id": "69cc9bb31aacdcc17b25514a",
  },
};

// ==========================================
// PAGE COMPONENT
// ==========================================

export default async function GamePage() {
  const platform = await resolveRuntimePlatform();
  // Fetch game data in server component
  const [{ game }, lastGameResult] = await Promise.all([
    getCurrentOrNextGame(platform),
    getLastGameWinners(platform),
  ]);

  return (
    <RealtimeProvider
      gameId={game?.id ?? null}
    >
      <GameHub game={game} lastGameResult={lastGameResult} />
      <BottomNav />
    </RealtimeProvider>
  );
}
