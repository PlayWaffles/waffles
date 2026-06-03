import { prisma } from "@/lib/db";
import type { GameNetwork } from "@/lib/chain/network";

const PUBLIC_GAME_NUMBER_START_AT_BY_NETWORK: Partial<Record<GameNetwork, Date>> = {
  CELO_MAINNET: new Date("2026-06-03T14:00:00.000Z"),
};

export async function getNextGameNumberForNetwork(network: GameNetwork) {
  const publicStartAt = PUBLIC_GAME_NUMBER_START_AT_BY_NETWORK[network];
  const highestNumber = await prisma.game.aggregate({
    where: {
      network,
      ...(publicStartAt ? { startsAt: { gte: publicStartAt } } : {}),
    },
    _max: { gameNumber: true },
  });

  return (highestNumber._max.gameNumber ?? 0) + 1;
}
