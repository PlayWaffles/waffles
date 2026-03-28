/**
 * Game Layout
 *
 * Shared game layout.
 */

import { GameHeader } from "./game/_components/GameHeader";
import { getCurrentOrNextGame } from "@/lib/game";
import { formatGameLabel } from "@/lib/game/labels";
import { resolveRuntimePlatform } from "@/lib/platform/server";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const platform = await resolveRuntimePlatform();
  const { game } = await getCurrentOrNextGame(platform);
  const headerTitle = game ? formatGameLabel(game.gameNumber) : null;

  return (
    <>
      <GameHeader title={headerTitle} />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </>
  );
}

// Force dynamic rendering
export const dynamic = "force-dynamic";
