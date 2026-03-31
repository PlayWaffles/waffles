import { Metadata } from "next";
import { getCurrentOrNextGame } from "@/lib/game";
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
};

// ==========================================
// PAGE COMPONENT
// ==========================================

export default async function GamePage() {
  const platform = await resolveRuntimePlatform();
  // Fetch game data in server component
  const { game } = await getCurrentOrNextGame(platform);

  return (
    <RealtimeProvider
      gameId={game?.id ?? null}
    >
      <GameHub game={game} />
      <BottomNav />
    </RealtimeProvider>
  );
}
