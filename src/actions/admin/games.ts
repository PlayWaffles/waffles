"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { logAdminAction, AdminAction, EntityType } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createGameOnChain, generateOnchainGameId } from "@/lib/chain";
import { GameTheme, UserPlatform } from "@prisma";
import { recalculateGameRounds } from "@/lib/game/rounds";
import { formatGameLabel } from "@/lib/game/labels";
import { rankGame, publishResults } from "@/lib/game/lifecycle";
import { defaultNetworkForPlatform } from "@/lib/chain";

// ==========================================
// SCHEMA
// ==========================================

const gameSchema = z.object({
  platform: z.enum(UserPlatform),
  createOnMultiplePlatforms: z
    .union([z.literal("true"), z.literal("false"), z.undefined()])
    .transform((value) => value === "true"),
  // NOTE: startsAt and endsAt should be ISO 8601 strings (with timezone/UTC).
  // The client converts datetime-local values to ISO format before submission
  // to ensure consistent timezone handling between local and production servers.
  startsAt: z.string().transform((str) => new Date(str)),
  endsAt: z.string().transform((str) => new Date(str)),
  ticketsOpenAt: z
    .union([z.literal(""), z.string()])
    .optional()
    .transform((str) => (str ? new Date(str) : null)),
  ticketPrice: z.coerce.number().min(0, "Ticket price must be non-negative"),
  roundBreakSec: z.coerce
    .number()
    .min(5, "Duration must be at least 5 seconds"),
  maxPlayers: z.coerce.number().min(2, "Must allow at least 2 players"),
  skipQuestions: z
    .union([z.literal("true"), z.literal("false"), z.undefined()])
    .transform((value) => value === "true"),
});

export type GameActionResult =
  | { success: true; gameId?: string }
  | { success: false; error: string };

const DEFAULT_GAME_THEME = GameTheme.MOVIES;
const DEFAULT_GAME_COVER_URL = "/images/movies-cover.png";
const AUTO_QUESTION_COUNT = 9;

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
  templates: {
    id: string;
    content: string;
    options: string[];
    correctIndex: number;
    durationSec: number;
    mediaUrl: string | null;
    soundUrl: string | null;
  }[],
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

// ==========================================
// CREATE GAME
// ==========================================

export async function createGameAction(
  _prevState: GameActionResult | null,
  formData: FormData,
): Promise<GameActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const adminId = authResult.session.userId;

  // 1. VALIDATE INPUT
  const rawData = {
    platform: formData.get("platform"),
    createOnMultiplePlatforms:
      formData.get("createOnMultiplePlatforms") ?? "false",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    ticketsOpenAt: formData.get("ticketsOpenAt") ?? "",
    ticketPrice: formData.get("ticketPrice"),
    roundBreakSec: formData.get("roundBreakSec"),
    maxPlayers: formData.get("maxPlayers"),
    skipQuestions: formData.get("skipQuestions") ?? "false",
  };

  const validation = gameSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validation.data;

  if (data.ticketsOpenAt && data.ticketsOpenAt >= data.startsAt) {
    return {
      success: false,
      error: "Tickets must open before the game starts",
    };
  }

  const platforms = data.createOnMultiplePlatforms
    ? [UserPlatform.FARCASTER, UserPlatform.MINIPAY]
    : [data.platform];
  const launchGroupId = crypto.randomUUID();
  const selectedTemplates = data.skipQuestions
    ? null
    : await getAutoQuestionTemplates();
  const createdGames: { id: string; platform: UserPlatform; title: string }[] = [];
  const failures: string[] = [];

  // Derive next game number from highest existing number (avoids gaps from deleted games
  // more gracefully than count, and the @unique constraint protects against races)
  const lastGame = await prisma.game.findFirst({
    orderBy: { gameNumber: "desc" },
    select: { gameNumber: true },
  });
  let nextGameNumber = (lastGame?.gameNumber ?? 0) + 1;

  for (const platform of platforms) {
    const network = defaultNetworkForPlatform(platform);
    const onchainId = generateOnchainGameId();
    let gameId: string | null = null;
    const gameNumber = nextGameNumber++;

    try {
      const game = await prisma.game.create({
        data: {
          title: formatGameLabel(gameNumber),
          gameNumber,
          platform,
          network,
          isTestnet: network !== "BASE_MAINNET",
          description: null,
          theme: DEFAULT_GAME_THEME,
          coverUrl: DEFAULT_GAME_COVER_URL,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          ticketsOpenAt: data.ticketsOpenAt,
          tierPrices: [data.ticketPrice],
          prizePool: 0,
          playerCount: 0,
          roundBreakSec: data.roundBreakSec,
          maxPlayers: data.maxPlayers,
          onchainId,
          launchGroupId,
        },
      });
      gameId = game.id;

      const { initGameRoom } = await import("@/lib/partykit");
      await initGameRoom(game.id, game.startsAt, game.endsAt);

      if (selectedTemplates) {
        await assignAutoQuestionsToGame(game.id, selectedTemplates);
      }

      const txHash = await createGameOnChain(
        platform,
        network,
        onchainId,
        data.ticketPrice,
      );

      const templates = await import("@/lib/notifications/templates");
      const { sendBatch } = await import("@/lib/notifications");

      // If tickets open later, announce the game; otherwise tell users tickets are live
      const notifTemplate = data.ticketsOpenAt
        ? templates.preGame.gameScheduled(gameNumber)
        : templates.preGame.gameOpen(gameNumber);

      const usersToNotify = await prisma.user.findMany({
        where: {
          isBanned: false,
          platform,
        },
        select: { id: true },
      });

      if (usersToNotify.length > 0) {
        const payload = templates.buildPayload(
          notifTemplate,
          undefined,
          "pregame",
        );
        sendBatch(payload, usersToNotify.map((user) => user.id)).catch((err) => {
          console.error("[admin-games] notification_failed", {
            gameId: game.id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      console.log("[admin-games]", "game_created", {
        gameId: game.id,
        title: game.title,
        theme: DEFAULT_GAME_THEME,
        onchainId,
        txHash,
        gameNumber,
        platform,
        launchGroupId,
        notifiedUsers: usersToNotify.length,
      });

      await logAdminAction({
        adminId,
        action: AdminAction.CREATE_GAME,
        entityType: EntityType.GAME,
        entityId: game.id,
        details: {
          title: game.title,
          platform,
          network,
          theme: DEFAULT_GAME_THEME,
          onchainId,
          txHash,
          gameNumber,
          ticketPrice: data.ticketPrice,
          launchGroupId,
          autoQuestionCount: data.skipQuestions ? 0 : AUTO_QUESTION_COUNT,
        },
      });

      createdGames.push({ id: game.id, platform, title: game.title });
    } catch (error) {
      if (gameId) {
        await prisma.game.delete({ where: { id: gameId } }).catch((cleanupError) => {
          console.error("[admin-games]", "rollback_failed", {
            gameId,
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          });
        });
      }

      failures.push(
        `${platform}: ${error instanceof Error ? error.message : "Failed to create game"}`,
      );

      console.error("[admin-games]", "game_create_failed", {
        error: error instanceof Error ? error.message : String(error),
        gameId,
        platform,
        launchGroupId,
      });
    }
  }

  revalidatePath("/admin/games");

  if (!createdGames.length) {
    return {
      success: false,
      error: failures[0] || "Failed to create game",
    };
  }

  if (failures.length > 0) {
    return {
      success: false,
      error: `Created ${createdGames.length} game(s), but some platforms failed: ${failures.join(" | ")}`,
    };
  }

  redirect("/admin/games");
}

// ==========================================
// UPDATE GAME
// ==========================================

export async function updateGameAction(
  gameId: string,
  _prevState: GameActionResult | null,
  formData: FormData,
): Promise<GameActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  // 1. VALIDATE INPUT
  const rawData = {
    platform: formData.get("platform"),
    createOnMultiplePlatforms: "false",
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    ticketsOpenAt: formData.get("ticketsOpenAt") ?? "",
    ticketPrice: formData.get("ticketPrice"),
    roundBreakSec: formData.get("roundBreakSec"),
    maxPlayers: formData.get("maxPlayers"),
    skipQuestions: "false",
  };

  const validation = gameSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }
  const data = validation.data;

  try {
    const existingGame = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        tierPrices: true,
        ticketsOpenAt: true,
      },
    });

    if (!existingGame) {
      return { success: false, error: "Game not found" };
    }

    const existingPrice = existingGame.tierPrices[0] ?? 0;
    if (data.ticketPrice < existingPrice) {
      return {
        success: false,
        error:
          "This edit would lower the on-chain minimum ticket price. Create a new game instead.",
      };
    }

    // 2. UPDATE DATABASE
    // Reset sent notifications if ticketsOpenAt changed
    const ticketsOpenChanged =
      data.ticketsOpenAt?.getTime() !== existingGame.ticketsOpenAt?.getTime();

    const game = await prisma.game.update({
      where: { id: gameId },
      data: {
        platform: data.platform,
        description: null,
        theme: DEFAULT_GAME_THEME,
        coverUrl: DEFAULT_GAME_COVER_URL,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        ticketsOpenAt: data.ticketsOpenAt,
        tierPrices: [data.ticketPrice],
        roundBreakSec: data.roundBreakSec,
        maxPlayers: data.maxPlayers,
        ...(ticketsOpenChanged ? { ticketOpenNotifsSent: [] } : {}),
      },
    });

    // 3. SYNC TO PARTYKIT (throws on failure)
    const { updateGame } = await import("@/lib/partykit");
    await updateGame(game.id, game.startsAt, game.endsAt);

    // 4. LOG AND REVALIDATE
    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.UPDATE_GAME,
      entityType: EntityType.GAME,
      entityId: game.id,
      details: { title: game.title },
    });

    revalidatePath("/admin/games");
    revalidatePath(`/admin/games/${game.id}`);

    console.log("[admin-games] game_updated", {
      gameId: game.id,
      title: game.title,
    });

    return { success: true, gameId: game.id };
  } catch (error) {
    console.error("[admin-games] game_update_failed", {
      gameId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update game",
    };
  }
}

// ==========================================
// DELETE GAME
// ==========================================

export async function deleteGameAction(gameId: string): Promise<void> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    redirect("/admin/login");
  }

  // 1. FETCH GAME DATA
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      onchainId: true,
      platform: true,
      network: true,
      title: true,
      _count: { select: { entries: true } },
    },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  try {
    // 2. DELETE FROM DATABASE FIRST (easiest to recover if later steps fail)
    await prisma.game.delete({
      where: { id: gameId },
    });

    console.log("[admin-games] game_deleted_from_db", {
      gameId,
      title: game.title,
      entriesDeleted: game._count.entries,
    });

    // 3. CLEANUP PARTYKIT ROOM (best-effort, don't fail if it fails)
    try {
      const { cleanupGameRoom } = await import("@/lib/partykit");
      await cleanupGameRoom(gameId);
      console.log("[admin-games] partykit_cleanup_success", { gameId });
    } catch (err) {
      console.warn("[admin-games] partykit_cleanup_failed", {
        gameId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue - PartyKit cleanup is best-effort
    }

    // 4. CLOSE ON-CHAIN SALES (irreversible - do last, best-effort)
    if (game.onchainId) {
      try {
        const { getOnChainGame, closeSalesOnChain } =
          await import("@/lib/chain");
        const onChainGame = await getOnChainGame(
          game.platform,
          game.network,
          game.onchainId as `0x${string}`,
        );

        const needsClosing =
          onChainGame &&
          !onChainGame.salesClosed &&
          (onChainGame.ticketCount > BigInt(0) ||
            onChainGame.minimumTicketPrice > BigInt(0));

        if (needsClosing) {
          const txHash = await closeSalesOnChain(
            game.platform,
            game.network,
            game.onchainId as `0x${string}`,
          );
          console.log("[admin-games] onchain_sales_closed", { gameId, txHash });
        }
      } catch (err) {
        console.warn("[admin-games] onchain_close_failed", {
          gameId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue - game is already deleted from DB, on-chain cleanup is best-effort
      }
    }

    // 5. LOG ADMIN ACTION
    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.DELETE_GAME,
      entityType: EntityType.GAME,
      entityId: gameId,
      details: {
        title: game.title,
        onchainId: game.onchainId,
        entriesDeleted: game._count.entries,
      },
    });

    console.log("[admin-games] game_delete_complete", {
      gameId,
      title: game.title,
    });
  } catch (error) {
    console.error("[admin-games] game_delete_failed", {
      gameId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  revalidatePath("/admin/games");
  redirect("/admin/games");
}

// ==========================================
// ROUNDUP (RANK + PUBLISH)
// ==========================================

export async function roundupGameAction(gameId: string): Promise<{
  success: boolean;
  error?: string;
  entriesRanked?: number;
  prizesDistributed?: number;
  published?: boolean;
}> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }
  const adminId = authResult.session.userId;

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, onchainId: true, endsAt: true, rankedAt: true, title: true },
    });

    if (!game) return { success: false, error: "Game not found" };
    if (game.endsAt > new Date()) return { success: false, error: "Game has not ended yet" };

    // 1. Rank entries
    const rankResult = await rankGame(gameId);

    // 2. Publish on-chain if applicable
    let published = false;
    if (game.onchainId && rankResult.prizesDistributed > 0) {
      const publishResult = await publishResults(gameId);
      published = publishResult.success;
    }

    await logAdminAction({
      adminId,
      action: AdminAction.CHANGE_GAME_STATUS,
      entityType: EntityType.GAME,
      entityId: gameId,
      details: {
        action: "roundup",
        entriesRanked: rankResult.entriesRanked,
        prizesDistributed: rankResult.prizesDistributed,
        published,
      },
    });

    console.log("[admin-games] roundup_complete", {
      gameId,
      title: game.title,
      entriesRanked: rankResult.entriesRanked,
      prizesDistributed: rankResult.prizesDistributed,
      published,
    });

    revalidatePath(`/admin/games/${gameId}`);

    return {
      success: true,
      entriesRanked: rankResult.entriesRanked,
      prizesDistributed: rankResult.prizesDistributed,
      published,
    };
  } catch (e) {
    console.error("[admin-games] roundup_failed", {
      gameId,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      success: false,
      error: e instanceof Error ? e.message : "Roundup failed",
    };
  }
}
