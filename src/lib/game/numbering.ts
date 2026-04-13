import { prisma } from "@/lib/db";
import type { GameNetwork } from "@/lib/chain/network";

export async function getNextGameNumberForNetwork(network: GameNetwork) {
  const highestNumber = await prisma.game.aggregate({
    where: { network },
    _max: { gameNumber: true },
  });

  return (highestNumber._max.gameNumber ?? 0) + 1;
}
