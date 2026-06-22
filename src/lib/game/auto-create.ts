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

function isLaunchGroupConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("launchGroupId") &&
    error.meta.target.includes("platform")
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
  launchGroupId?: string;
}

type QT = Awaited<ReturnType<typeof prisma.questionTemplate.findMany>>[number];
type AutoQuestionCandidate = {
  id: string;
  category: string | null;
  usageCount: number;
};

function pickDiverseQuestionIds(candidates: AutoQuestionCandidate[]) {
  const pickedIds: string[] = [];
  const seenCat = new Set<string>();

  for (const candidate of candidates) {
    if (pickedIds.length >= AUTO_QUESTION_COUNT) break;
    const category = candidate.category ?? "_general";
    if (!seenCat.has(category)) {
      seenCat.add(category);
      pickedIds.push(candidate.id);
    }
  }

  for (const candidate of candidates) {
    if (pickedIds.length >= AUTO_QUESTION_COUNT) break;
    if (!pickedIds.includes(candidate.id)) pickedIds.push(candidate.id);
  }

  return pickedIds;
}

// Build a category-varied question set while protecting players from seeing the
// same templates over and over. Templates that have already appeared in more
// than one game are held back unless the fresher pool cannot fill the game.
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
    select: { id: true, category: true, usageCount: true },
  });
  const fresherCandidates = candidates.filter((candidate) => candidate.usageCount <= 1);
  const repeatedCandidates = candidates.filter((candidate) => candidate.usageCount > 1);
  const pickedIds = pickDiverseQuestionIds(fresherCandidates);

  if (pickedIds.length < AUTO_QUESTION_COUNT) {
    const repeatedIds = pickDiverseQuestionIds(repeatedCandidates);
    for (const id of repeatedIds) {
      if (pickedIds.length >= AUTO_QUESTION_COUNT) break;
      if (!pickedIds.includes(id)) pickedIds.push(id);
    }
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
            launchGroupId: input.launchGroupId ?? null,
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
        if (input.launchGroupId && isLaunchGroupConflict(error)) {
          const existing = await prisma.game.findFirst({
            where: {
              platform: input.platform,
              launchGroupId: input.launchGroupId,
            },
            select: { id: true, gameNumber: true },
          });
          if (existing) {
            return { gameId: existing.id, gameNumber: existing.gameNumber };
          }
        }
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

    // Real game details so the card reads "World Cup Bowl #010 announced".
    const { themeLabel } = await import("@/lib/player/roundQuestions");
    const meta = { title: game.title, category: themeLabel(game.theme) };
    const notifTemplate = input.ticketsOpenAt
      ? preGame.gameScheduled(gameNumber, meta)
      : preGame.gameOpen(gameNumber, undefined, undefined, meta);

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
