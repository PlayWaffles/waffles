import { prisma } from "@/lib/db";
import type { GameNetwork } from "@/lib/chain/network";

export async function getNextGameNumberForNetwork(network: GameNetwork) {
  const totalGamesOnNetwork = await prisma.game.count({
    where: { network },
  });

  return totalGamesOnNetwork + 1;
}
