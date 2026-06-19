import { GameTheme, Prisma, QuestionKind, UserPlatform } from "@prisma";
import { prisma } from "@/lib/db";
import { createGameOnChain, generateOnchainGameId } from "@/lib/chain";
import { defaultNetworkForPlatform } from "@/lib/chain";
import { recalculateGameRounds } from "@/lib/game/rounds";
import { generateGameTitle } from "@/lib/game/labels";
import { getNextGameNumberForNetwork } from "@/lib/game/numbering";
import { isTestnetNetwork } from "@/lib/chain/network";
import { sendBatch } from "@/lib/notifications";
import { preGame, buildPayload } from "@/lib/notifications/templates";
import { enforceMinimumTicketPriceForPlatform } from "@/lib/tickets";

// World Cup season — auto games are football-themed (questions + title +
// cover). Switch back to GameTheme.GENERAL (+ a general cover) after the
// World Cup ends.
const DEFAULT_GAME_THEME = GameTheme.FOOTBALL;
const DEFAULT_GAME_COVER_URL = "/images/themes/football-moments.webp";
const AUTO_QUESTION_COUNT = 6;
const GAME_NUMBER_RETRY_LIMIT = 3;

function isGameNumberConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("network") &&
    error.meta.target.includes("gameNumber")
  );
}

interface AutoQuestionTemplate {
  id: string;
  content: string;
  options: string[];
  correctIndex: number;
  durationSec: number;
  mediaUrl: string | null;
  soundUrl: string | null;
  // Format fields — must be carried into the game's Question rows or every
  // tournament question collapses to plain single-choice.
  kind: QuestionKind;
  correctSet: number[];
  pick: number | null;
  correctOrder: number[];
  flags: string[];
  minefield: boolean;
  kicker: string | null;
  clues: string[];
  // Authoring category (topic) — carried so the play UI shows the subject.
  category: string | null;
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

type QT = Awaited<ReturnType<typeof prisma.questionTemplate.findMany>>[number];

// Build a kind-VARIED question set so a round isn't all multiple-choice: take the
// least-used of each available non-single format (MULTI/ORDER/SPATIAL) first,
// then fill the rest with the least-used SINGLE questions, and shuffle so the
// varied formats don't always land in the same slots. (Least-used-first rotates
// the bank over time; usageCount is bumped when a template is assigned.)
async function getAutoQuestionTemplates() {
  const orderBy: Prisma.QuestionTemplateOrderByWithRelationInput[] = [
    { usageCount: "asc" },
    { updatedAt: "asc" },
    { createdAt: "asc" },
  ];

  // One question per distinct CATEGORY (= format/topic, e.g. "WC: Map Click",
  // "WC: Who Am I", "Sports") so a round showcases different styles instead of
  // six of the same. Least-used-first rotates the bank and surfaces the freshly
  // seeded formats; then top up with the next least-used if formats run short.
  const candidates = await prisma.questionTemplate.findMany({
    where: { theme: DEFAULT_GAME_THEME },
    orderBy,
    select: { id: true, category: true },
  });
  const seenCat = new Set<string>();
  const pickedIds: string[] = [];
  for (const c of candidates) {
    if (pickedIds.length >= AUTO_QUESTION_COUNT) break;
    const cat = c.category ?? "_general";
    if (!seenCat.has(cat)) {
      seenCat.add(cat);
      pickedIds.push(c.id);
    }
  }
  for (const c of candidates) {
    if (pickedIds.length >= AUTO_QUESTION_COUNT) break;
    if (!pickedIds.includes(c.id)) pickedIds.push(c.id);
  }

  if (pickedIds.length < AUTO_QUESTION_COUNT) {
    throw new Error(
      `Need at least ${AUTO_QUESTION_COUNT} ${DEFAULT_GAME_THEME} question templates before creating a game.`,
    );
  }
  const templates: QT[] = await prisma.questionTemplate.findMany({ where: { id: { in: pickedIds } } });

  // Fisher–Yates shuffle so the varied formats aren't always first.
  for (let i = templates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [templates[i], templates[j]] = [templates[j], templates[i]];
  }

  return templates;
}

async function assignAutoQuestionsToGame(
  gameId: string,
  templates: AutoQuestionTemplate[],
  countUsage: boolean,
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
        // Carry the format so the game question isn't flattened to single-choice.
        kind: template.kind,
        correctSet: template.correctSet,
        pick: template.pick,
        correctOrder: template.correctOrder,
        flags: template.flags,
        minefield: template.minefield,
        kicker: template.kicker,
        clues: template.clues,
        // Carry the topic so the play UI can show the subject, not the format.
        category: template.category,
        roundIndex: 1,
        orderInRound: index,
        templateId: template.id,
      })),
    });

    if (countUsage) {
      await Promise.all(
        templates.map((template) =>
          tx.questionTemplate.update({
            where: { id: template.id },
            data: { usageCount: { increment: 1 } },
          }),
        ),
      );
    }
  });

  await recalculateGameRounds(gameId);
}

export async function createAutoScheduledGame(input: AutoCreateGameInput) {
  const templates = await getAutoQuestionTemplates();
  const network = defaultNetworkForPlatform(input.platform);
  const ticketPrice = enforceMinimumTicketPriceForPlatform(
    input.ticketPrice,
    input.platform,
  );
  const onchainId = generateOnchainGameId();
  let gameNumber: number | null = null;
  let gameId: string | null = null;

  try {
    let game = null;
    for (let attempt = 0; attempt < GAME_NUMBER_RETRY_LIMIT; attempt += 1) {
      gameNumber = await getNextGameNumberForNetwork(network);

      try {
        game = await prisma.game.create({
          data: {
            title: generateGameTitle({ gameNumber, theme: DEFAULT_GAME_THEME }),
            gameNumber,
            platform: input.platform,
            network,
            isTestnet: isTestnetNetwork(network),
            description: null,
            theme: DEFAULT_GAME_THEME,
            coverUrl: DEFAULT_GAME_COVER_URL,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            ticketsOpenAt: input.ticketsOpenAt,
            tierPrices: [ticketPrice],
            prizePool: 0,
            playerCount: 0,
            roundBreakSec: input.roundBreakSec,
            maxPlayers: input.maxPlayers,
            onchainId,
          },
        });
        break;
      } catch (error) {
        if (!isGameNumberConflict(error) || attempt === GAME_NUMBER_RETRY_LIMIT - 1) {
          throw error;
        }
      }
    }

    if (!game || gameNumber === null) {
      throw new Error("Failed to allocate a game number");
    }
    gameId = game.id;

    await assignAutoQuestionsToGame(game.id, templates, !game.isTestnet);
    const txHash = await createGameOnChain(
      input.platform,
      network,
      onchainId,
      ticketPrice,
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
