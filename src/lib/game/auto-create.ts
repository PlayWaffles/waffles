import { GameTheme, UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { createGameOnChain, generateOnchainGameId } from "@/lib/chain";
import { defaultNetworkForPlatform } from "@/lib/chain";
import { recalculateGameRounds } from "@/lib/game/rounds";
import { formatGameLabel } from "@/lib/game/labels";
import { getNextGameNumberForNetwork } from "@/lib/game/numbering";
import { initGameRoom } from "@/lib/partykit";
import { sendBatch } from "@/lib/notifications";
import { preGame, buildPayload } from "@/lib/notifications/templates";

const DEFAULT_GAME_THEME = GameTheme.MOVIES;
const DEFAULT_GAME_COVER_URL = "/images/movies-cover.png";
const AUTO_QUESTION_COUNT = 9;

interface AutoQuestionTemplate {
  id: string;
  content: string;
  options: string[];
  correctIndex: number;
  durationSec: number;
  mediaUrl: string | null;
  soundUrl: string | null;
}

export interface AutoCreateGameInput {
  platform: UserPlatform;
  startsAt: Date;
  endsAt: Date;
  ticketsOpenAt: Date | null;
  ticketPrice: number;
  roundBreakSec: number;
  maxPlayers: number;
}

async function getAutoQuestionTemplates() {
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

  return templates;
}

async function assignAutoQuestionsToGame(
  gameId: string,
  templates: AutoQuestionTemplate[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.question.createMany({
      data: templates.map((template, index) => ({
        gameId,
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

  await recalculateGameRounds(gameId);
}

export async function createAutoScheduledGame(input: AutoCreateGameInput) {
  const templates = await getAutoQuestionTemplates();
  const network = defaultNetworkForPlatform(input.platform);
  const onchainId = generateOnchainGameId();
  const gameNumber = await getNextGameNumberForNetwork(network);
  let gameId: string | null = null;

  try {
    const game = await prisma.game.create({
      data: {
        title: formatGameLabel(gameNumber),
        gameNumber,
        platform: input.platform,
        network,
        isTestnet: network !== "BASE_MAINNET",
        description: null,
        theme: DEFAULT_GAME_THEME,
        coverUrl: DEFAULT_GAME_COVER_URL,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        ticketsOpenAt: input.ticketsOpenAt,
        tierPrices: [input.ticketPrice],
        prizePool: 0,
        playerCount: 0,
        roundBreakSec: input.roundBreakSec,
        maxPlayers: input.maxPlayers,
        onchainId,
      },
    });
    gameId = game.id;

    await initGameRoom(game.id, game.startsAt, game.endsAt);
    await assignAutoQuestionsToGame(game.id, templates);
    const txHash = await createGameOnChain(
      input.platform,
      network,
      onchainId,
      input.ticketPrice,
    );

    const notifTemplate = input.ticketsOpenAt
      ? preGame.gameScheduled(gameNumber)
      : preGame.gameOpen(gameNumber);

    const usersToNotify = await prisma.user.findMany({
      where: {
        isBanned: false,
        platform: input.platform,
      },
      select: { id: true },
    });

    if (usersToNotify.length > 0) {
      const payload = buildPayload(notifTemplate, undefined, "pregame");
      sendBatch(payload, usersToNotify.map((user) => user.id)).catch((err) => {
        console.error("[auto-game] notification_failed", {
          gameId: game.id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    console.log("[auto-game] created", {
      gameId: game.id,
      gameNumber,
      platform: input.platform,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
      ticketsOpenAt: input.ticketsOpenAt?.toISOString() ?? null,
      txHash,
    });

    return { gameId: game.id, gameNumber };
  } catch (error) {
    if (gameId) {
      await prisma.game.delete({ where: { id: gameId } }).catch((cleanupError) => {
        console.error("[auto-game] rollback_failed", {
          gameId,
          error:
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError),
        });
      });
    }

    throw error;
  }
}
