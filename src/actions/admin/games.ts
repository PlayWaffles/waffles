"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { logAdminAction, AdminAction, EntityType } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createGameOnChain, generateOnchainGameId } from "@/lib/chain";
import { GameTheme, UserPlatform } from "@prisma";

// ==========================================
// SCHEMA
// ==========================================

const gameSchema = z.object({
  platform: z.enum(UserPlatform),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  theme: z.enum(GameTheme),
  coverUrl: z.string().min(1, "Cover URL is required"),
  // NOTE: startsAt and endsAt should be ISO 8601 strings (with timezone/UTC).
  // The client converts datetime-local values to ISO format before submission
  // to ensure consistent timezone handling between local and production servers.
  startsAt: z.string().transform((str) => new Date(str)),
  endsAt: z.string().transform((str) => new Date(str)),
  tierPrice1: z.coerce.number().min(0, "Tier price must be non-negative"),
  tierPrice2: z.coerce.number().min(0, "Tier price must be non-negative"),
  tierPrice3: z.coerce.number().min(0, "Tier price must be non-negative"),
  roundBreakSec: z.coerce
    .number()
    .min(5, "Duration must be at least 5 seconds"),
  maxPlayers: z.coerce.number().min(2, "Must allow at least 2 players"),
});

export type GameActionResult =
  | { success: true; gameId?: string }
  | { success: false; error: string };

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
    title: formData.get("title"),
    description: formData.get("description"),
    theme: formData.get("theme"),
    coverUrl: formData.get("coverUrl"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    tierPrice1: formData.get("tierPrice1"),
    tierPrice2: formData.get("tierPrice2"),
    tierPrice3: formData.get("tierPrice3"),
    roundBreakSec: formData.get("roundBreakSec"),
    maxPlayers: formData.get("maxPlayers"),
  };

  const validation = gameSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validation.data;
  const onchainId = generateOnchainGameId();
  let gameId: string | null = null;

  try {
    // 2. DATABASE FIRST (easily reversible)
    const game = await prisma.game.create({
      data: {
        title: data.title,
        platform: data.platform,
        description: data.description || null,
        theme: data.theme,
        coverUrl: data.coverUrl,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        tierPrices: [data.tierPrice1, data.tierPrice2, data.tierPrice3],
        prizePool: 0,
        playerCount: 0,
        roundBreakSec: data.roundBreakSec,
        maxPlayers: data.maxPlayers,
        onchainId,
      },
    });
    gameId = game.id;

    // 3. PARTYKIT INIT (reversible - throws on failure)
    const { initGameRoom } = await import("@/lib/partykit");
    await initGameRoom(game.id, game.startsAt, game.endsAt);

    // 4. ON-CHAIN LAST (irreversible - only when everything else succeeded)
    const txHash = await createGameOnChain(onchainId, data.tierPrice1);

    // 5. CALCULATE GAME NUMBER & SEND NOTIFICATION
    // We count existing games to determine the number (e.g. #024)
    const gamesCount = await prisma.game.count();
    const gameNumber = gamesCount; // Since we just created one, count includes it

    // Update game with number (best effort)
    await prisma.game.update({
      where: { id: game.id },
      data: { gameNumber },
    });

    // Send "Game Open" notification to all users (fire-and-forget)
    const template = (await import("@/lib/notifications/templates")).preGame
      .gameOpen;
    const { sendBatch } = await import("@/lib/notifications");
    const { env } = await import("@/lib/env");
    const { buildPayload } = await import("@/lib/notifications/templates");

    const usersToNotify = await prisma.user.findMany({
      where: {
        hasGameAccess: true,
        isBanned: false,
        platform: data.platform,
      },
      select: { id: true },
    });

    if (usersToNotify.length > 0) {
      const payload = buildPayload(template(gameNumber), undefined, "pregame");
      sendBatch(payload, usersToNotify.map((u) => u.id)).catch(
        (err) => {
          console.error("[admin-games] notification_failed", {
            gameId: game.id,
            error: err instanceof Error ? err.message : String(err),
          });
        },
      );
    }

    console.log("[admin-games]", "game_created", {
      gameId: game.id,
      title: game.title,
      theme: data.theme,
      onchainId,
      txHash,
      gameNumber,
      notifiedUsers: usersToNotify.length,
    });

    // 6. LOG AND CLEANUP
    await logAdminAction({
      adminId,
      action: AdminAction.CREATE_GAME,
      entityType: EntityType.GAME,
      entityId: game.id,
      details: {
        title: game.title,
        platform: data.platform,
        theme: data.theme,
        onchainId,
        txHash,
        gameNumber,
      },
    });

    revalidatePath("/admin/games");
  } catch (error) {
    // ROLLBACK: Delete DB record if we created one
    if (gameId) {
      await prisma.game.delete({ where: { id: gameId } }).catch((e) => {
        console.error("[admin-games]", "rollback_failed", {
          gameId,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }
    // Note: On-chain cannot be rolled back, but we do on-chain LAST so this shouldn't happen

    console.error("[admin-games]", "game_create_failed", {
      error: error instanceof Error ? error.message : String(error),
      gameId,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create game",
    };
  }

  // Redirect outside try/catch (Next.js redirect throws internally)
  redirect(`/admin/games/${gameId}/questions`);
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
    title: formData.get("title"),
    description: formData.get("description"),
    theme: formData.get("theme"),
    coverUrl: formData.get("coverUrl"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    tierPrice1: formData.get("tierPrice1"),
    tierPrice2: formData.get("tierPrice2"),
    tierPrice3: formData.get("tierPrice3"),
    roundBreakSec: formData.get("roundBreakSec"),
    maxPlayers: formData.get("maxPlayers"),
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
    // 2. UPDATE DATABASE
    const game = await prisma.game.update({
      where: { id: gameId },
      data: {
        title: data.title,
        platform: data.platform,
        description: data.description || null,
        theme: data.theme,
        coverUrl: data.coverUrl,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        tierPrices: [data.tierPrice1, data.tierPrice2, data.tierPrice3],
        roundBreakSec: data.roundBreakSec,
        maxPlayers: data.maxPlayers,
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
          game.onchainId as `0x${string}`,
        );

        const needsClosing =
          onChainGame &&
          !onChainGame.salesClosed &&
          (onChainGame.ticketCount > BigInt(0) ||
            onChainGame.minimumTicketPrice > BigInt(0));

        if (needsClosing) {
          const txHash = await closeSalesOnChain(
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
