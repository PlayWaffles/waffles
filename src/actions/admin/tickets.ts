"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { TicketPurchaseSource } from "@prisma";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser } from "@/lib/notifications";
import { formatGameTime } from "@/lib/utils";

export type IssueFreeTicketResult =
  | { success: true; entryId: string; message: string }
  | { success: false; error: string };

const issueFreeTicketSchema = z.object({
  gameId: z.string().min(1, "Game is required"),
  userQuery: z.string().min(1, "User is required"),
  note: z.string().max(255, "Note must be 255 characters or fewer").optional(),
});

export async function issueFreeTicketAction(
  _prevState: IssueFreeTicketResult | null,
  formData: FormData,
): Promise<IssueFreeTicketResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }
  const session = auth.session;

  const parsed = issueFreeTicketSchema.safeParse({
    gameId: formData.get("gameId"),
    userQuery: formData.get("userQuery"),
    note: formData.get("note")?.toString().trim() || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { gameId, userQuery, note } = parsed.data;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      title: true,
      platform: true,
      startsAt: true,
      endsAt: true,
      playerCount: true,
      maxPlayers: true,
      prizePool: true,
    },
  });

  if (!game) {
    return { success: false, error: "Game not found" };
  }

  if (new Date() >= game.endsAt) {
    return { success: false, error: "Cannot issue a free ticket after the game ends" };
  }

  const normalizedQuery = userQuery.trim();
  const maybeFid = Number.parseInt(normalizedQuery, 10);

  const user = await prisma.user.findFirst({
    where: {
      platform: game.platform,
      OR: [
        { id: normalizedQuery },
        { wallet: { equals: normalizedQuery, mode: "insensitive" } },
        { username: { equals: normalizedQuery, mode: "insensitive" } },
        ...(!Number.isNaN(maybeFid) ? [{ fid: maybeFid }] : []),
      ],
    },
    select: {
      id: true,
      username: true,
      pfpUrl: true,
      hasGameAccess: true,
      isBanned: true,
    },
  });

  if (!user) {
    return { success: false, error: "User not found on this platform" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingEntry = await tx.gameEntry.findUnique({
      where: { gameId_userId: { gameId, userId: user.id } },
      select: { id: true },
    });

    if (existingEntry) {
      return { error: "User already has a ticket for this game" } as const;
    }

    const currentGame = await tx.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        playerCount: true,
        maxPlayers: true,
        prizePool: true,
      },
    });

    if (!currentGame) {
      return { error: "Game not found" } as const;
    }

    if (currentGame.playerCount >= currentGame.maxPlayers) {
      return { error: "Game is full" } as const;
    }

    const entry = await tx.gameEntry.create({
      data: {
        gameId,
        userId: user.id,
        paidAmount: 0,
        purchaseSource: TicketPurchaseSource.FREE_ADMIN,
        freeIssuedById: session.userId,
        freeIssueNote: note ?? null,
      },
      select: { id: true },
    });

    const updatedGame = await tx.game.update({
      where: { id: gameId },
      data: {
        playerCount: { increment: 1 },
      },
      select: {
        prizePool: true,
        playerCount: true,
      },
    });

    return {
      entryId: entry.id,
      prizePool: updatedGame.prizePool,
      playerCount: updatedGame.playerCount,
    } as const;
  });

  if ("error" in result) {
    return { success: false, error: result.error ?? "Failed to issue free ticket" };
  }

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");

  notifyTicketPurchased(gameId, {
    username: user.username || "Player",
    pfpUrl: user.pfpUrl || null,
    prizePool: result.prizePool,
    playerCount: result.playerCount,
  }).catch((error) =>
    console.error("[admin-tickets] free_ticket_notify_partykit_failed", error),
  );

  if (user.hasGameAccess && !user.isBanned) {
    sendToUser(user.id, {
      title: "Free ticket unlocked",
      body: `You have a complimentary ticket for Waffles at ${formatGameTime(game.startsAt)}.`,
      targetUrl: "/game",
    }).catch((error) =>
      console.error("[admin-tickets] free_ticket_notify_user_failed", error),
    );
  }

  return {
    success: true,
    entryId: result.entryId,
    message: "Free ticket issued successfully",
  };
}
