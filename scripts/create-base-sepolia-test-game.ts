import { prisma } from "@/lib/db";
import { GameTheme, UserPlatform } from "@prisma";
import { generateOnchainGameId, createGameOnChain } from "@/lib/chain";
import { initGameRoom } from "@/lib/partykit";
import { recalculateGameRounds } from "@/lib/game/rounds";
import { formatGameLabel } from "@/lib/game/labels";

const DEFAULT_GAME_THEME = GameTheme.MOVIES;
const DEFAULT_GAME_COVER_URL = "/images/movies-cover.png";
const AUTO_QUESTION_COUNT = 9;

async function main() {
  const platform = UserPlatform.FARCASTER;
  const network = "BASE_SEPOLIA" as const;
  const now = new Date();
  const startsAt = new Date(now.getTime() + 10 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  const ticketsOpenAt = now;
  const ticketPrice = 1;
  const roundBreakSec = 15;
  const maxPlayers = 50;

  const templates = await prisma.questionTemplate.findMany({
    where: { theme: DEFAULT_GAME_THEME },
    orderBy: [
      { usageCount: "asc" },
      { updatedAt: "asc" },
      { createdAt: "asc" },
    ],
    take: AUTO_QUESTION_COUNT,
  });

  if (templates.length < AUTO_QUESTION_COUNT) {
    throw new Error(
      `Need at least ${AUTO_QUESTION_COUNT} movie question templates before creating a game.`,
    );
  }

  const lastGame = await prisma.game.findFirst({
    orderBy: { gameNumber: "desc" },
    select: { gameNumber: true },
  });

  const gameNumber = (lastGame?.gameNumber ?? 0) + 1;
  const onchainId = generateOnchainGameId();
  let gameId: string | null = null;

  try {
    const game = await prisma.game.create({
      data: {
        title: `${formatGameLabel(gameNumber)} TESTNET`,
        gameNumber,
        platform,
        network,
        isTestnet: true,
        description: "Quick Base Sepolia test game",
        theme: DEFAULT_GAME_THEME,
        coverUrl: DEFAULT_GAME_COVER_URL,
        startsAt,
        endsAt,
        ticketsOpenAt,
        tierPrices: [ticketPrice],
        prizePool: 0,
        playerCount: 0,
        roundBreakSec,
        maxPlayers,
        onchainId,
      },
    });
    gameId = game.id;

    await prisma.$transaction(async (tx) => {
      await tx.question.createMany({
        data: templates.map((template, index) => ({
          gameId: game.id,
          content: template.content,
          options: template.options,
          correctIndex: template.correctIndex,
          durationSec: template.durationSec,
          mediaUrl: template.mediaUrl,
          soundUrl: template.soundUrl,
          roundIndex: 1,
          orderInRound: index,
          templateId: template.id,
        })),
      });

      await Promise.all(
        templates.map((template) =>
          tx.questionTemplate.update({
            where: { id: template.id },
            data: { usageCount: { increment: 1 } },
          }),
        ),
      );
    });

    await recalculateGameRounds(game.id);
    await initGameRoom(game.id, startsAt, endsAt);
    const txHash = await createGameOnChain(platform, network, onchainId, ticketPrice);

    console.log(
      JSON.stringify(
        {
          success: true,
          gameId: game.id,
          title: game.title,
          gameNumber,
          platform,
          network,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          ticketsOpenAt: ticketsOpenAt.toISOString(),
          onchainId,
          txHash,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (gameId) {
      await prisma.game.delete({ where: { id: gameId } }).catch(() => {});
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
