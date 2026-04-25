import { BottomNav } from "@/components/BottomNav";
import { Providers } from "@/components/providers";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { getCurrentOrNextGame, getLastGameWinners } from "@/lib/game";
import { formatGameLabel } from "@/lib/game/labels";
import {
  resolvePlatformGameVisibility,
  resolveRuntimePlatform,
} from "@/lib/platform/server";

import { GameHeader } from "./(app)/(game)/game/_components/GameHeader";
import { GameHub } from "./(app)/(game)/game/client";

export default async function Home() {
  const platform = await resolveRuntimePlatform();
  const visibility = await resolvePlatformGameVisibility(platform);
  const [{ game }, lastGameResult] = await Promise.all([
    getCurrentOrNextGame(platform),
    getLastGameWinners(platform),
  ]);
  const headerTitle = game ? formatGameLabel(game.gameNumber) : null;
  const isCurrentGameLive = game
    ? Date.now() >= game.startsAt.getTime() && Date.now() < game.endsAt.getTime()
    : false;

  return (
    <Providers>
      <main className="h-dvh flex flex-col overflow-hidden app-background">
        <GameHeader
          title={headerTitle}
          isCurrentGameLive={isCurrentGameLive}
          initialShowMiniPayTestnet={visibility.includeTestnet === true}
        />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <RealtimeProvider gameId={game?.id ?? null}>
            <GameHub game={game} lastGameResult={lastGameResult} />
            <BottomNav />
          </RealtimeProvider>
        </div>
      </main>
    </Providers>
  );
}

export const dynamic = "force-dynamic";
