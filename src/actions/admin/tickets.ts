"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { TicketPurchaseSource } from "@prisma";
import { notifyTicketPurchased } from "@/lib/partykit";
import { sendToUser } from "@/lib/notifications";
import { formatGameTime } from "@/lib/utils";
import { inspectTicketPurchase } from "@/lib/chain";
import type { ChainPlatform } from "@/lib/chain/platform";
import type { GameNetwork } from "@/lib/chain/network";
import { logAdminAction, AdminAction, EntityType } from "@/lib/audit";
import { unlockReferralRewards } from "@/lib/game/shared";
import {
  attachWalletToFarcasterUser,
  resolveUserByWalletForPlatform,
} from "@/lib/user-wallets";

export type IssueFreeTicketResult =
  | { success: true; entryId: string; message: string }
  | { success: false; error: string };

export type ReconcilePaidTicketResult =
  | { success: true; entryId: string; message: string }
  | { success: false; error: string };

const issueFreeTicketSchema = z.object({
  gameId: z.string().min(1, "Game is required"),
  userQuery: z.string().min(1, "User is required"),
  note: z.string().max(255, "Note must be 255 characters or fewer").optional(),
});

const reconcilePaidTicketSchema = z.object({
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "Enter a valid transaction hash"),
});

const reconcilePaidTicketToUserSchema = reconcilePaidTicketSchema.extend({
  userQuery: z.string().trim().min(1, "Username is required"),
});

type InspectedPurchase = {
  platform: ChainPlatform;
  network: GameNetwork;
  gameId: `0x${string}`;
  buyer: `0x${string}`;
  amount: bigint;
  amountFormatted: string;
};

async function inspectPaidTicketPurchase(txHash: string): Promise<InspectedPurchase | null> {
  const platforms: ChainPlatform[] = ["FARCASTER", "MINIPAY"];

  for (const platform of platforms) {
    for (const network of getReconcileTargets(platform)) {
      const result = await inspectTicketPurchase({
        platform,
        network,
        txHash: txHash as `0x${string}`,
      });

      if (result.found && result.details) {
        return {
          platform,
          network,
          ...result.details,
        };
      }
    }
  }

  return null;
}

async function findUserForPlatform(platform: ChainPlatform, userQuery: string) {
  const normalizedQuery = userQuery.trim();
  const normalizedUsername =
    normalizedQuery.startsWith("@") && normalizedQuery.length > 1
      ? normalizedQuery.slice(1)
      : normalizedQuery;
  const maybeFid = Number.parseInt(normalizedUsername, 10);

  return prisma.user.findFirst({
    where: {
      platform,
      OR: [
        { id: normalizedQuery },
        { wallet: { equals: normalizedQuery, mode: "insensitive" } },
        { username: { equals: normalizedUsername, mode: "insensitive" } },
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
}

function getReconcileTargets(platform: ChainPlatform): GameNetwork[] {
  if (platform === "FARCASTER") {
    return ["BASE_MAINNET", "BASE_SEPOLIA"];
  }

  return ["CELO_SEPOLIA"];
}

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

  const user = await findUserForPlatform(game.platform, userQuery);

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

export async function reconcilePaidTicketAction(
  _prevState: ReconcilePaidTicketResult | null,
  formData: FormData,
): Promise<ReconcilePaidTicketResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }
  const session = auth.session;

  const parsed = reconcilePaidTicketSchema.safeParse({
    txHash: formData.get("txHash")?.toString().trim(),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const txHash = parsed.data.txHash;
  const inspected = await inspectPaidTicketPurchase(txHash);

  if (!inspected) {
    return {
      success: false,
      error:
        "No valid TicketPurchased event was found for this txHash on the supported platforms.",
    };
  }

  const existingByTxHash = await prisma.gameEntry.findUnique({
    where: { txHash },
    select: { id: true, gameId: true, userId: true },
  });

  if (existingByTxHash) {
    return {
      success: true,
      entryId: existingByTxHash.id,
      message: "This purchase is already synced in the database.",
    };
  }

  const game = await prisma.game.findFirst({
    where: {
      platform: inspected.platform,
      network: inspected.network,
      onchainId: { equals: inspected.gameId, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      rankedAt: true,
      onChainAt: true,
      playerCount: true,
      prizePool: true,
    },
  });

  if (!game) {
    return {
      success: false,
      error: "This on-chain purchase does not map to any game in the database.",
    };
  }

  const user = await prisma.$transaction((tx) =>
    resolveUserByWalletForPlatform(tx, inspected.platform, inspected.buyer),
  );

  if (!user) {
    return {
      success: false,
      error:
        "No user with that wallet exists on this platform yet. Create or sync the user first, then retry.",
    };
  }

  const existingEntry = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId: game.id, userId: user.id } },
    select: { id: true, purchaseSource: true },
  });

  if (existingEntry) {
    return {
      success: false,
      error:
        existingEntry.purchaseSource === TicketPurchaseSource.PAID
          ? "This user already has a paid entry for the game."
          : "This user already has an entry for the game. Resolve that existing entry before reconciling this purchase.",
    };
  }

  const paidAmount = Number(inspected.amountFormatted);
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return {
      success: false,
      error: "Unable to derive a valid ticket amount from the on-chain purchase.",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.gameEntry.create({
      data: {
        gameId: game.id,
        userId: user.id,
        txHash,
        payerWallet: inspected.buyer,
        paidAmount,
        paidAt: new Date(),
        purchaseSource: TicketPurchaseSource.PAID,
      },
      select: { id: true },
    });

    const updatedGame = await tx.game.update({
      where: { id: game.id },
      data: {
        playerCount: { increment: 1 },
        prizePool: { increment: paidAmount },
      },
      select: {
        playerCount: true,
        prizePool: true,
      },
    });

    await unlockReferralRewards(tx, user.id);

    return {
      entryId: entry.id,
      playerCount: updatedGame.playerCount,
      prizePool: updatedGame.prizePool,
    };
  });

  await logAdminAction({
    adminId: session.userId,
    action: AdminAction.MANUAL_TICKET_CREATE,
    entityType: EntityType.TICKET,
    entityId: result.entryId,
    details: {
      source: "onchain_reconcile",
      txHash,
      gameId: game.id,
      userId: user.id,
      wallet: inspected.buyer,
      platform: inspected.platform,
      network: inspected.network,
      paidAmount,
    },
  });

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/games/${game.id}`);
  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");

  notifyTicketPurchased(game.id, {
    username: user.username || "Player",
    pfpUrl: user.pfpUrl || null,
    prizePool: result.prizePool,
    playerCount: result.playerCount,
  }).catch((error) =>
    console.error("[admin-tickets] reconcile_paid_ticket_partykit_failed", error),
  );

  if (user.hasGameAccess && !user.isBanned) {
    void import("@/lib/notifications/templates").then(
      ({ transactional, buildPayload }) => {
        const payload = buildPayload(
          transactional.ticketSecured(formatGameTime(game.startsAt)),
        );
        sendToUser(user.id, payload).catch((error) =>
          console.error("[admin-tickets] reconcile_paid_ticket_notify_failed", error),
        );
      },
    );
  }

  return {
    success: true,
    entryId: result.entryId,
    message: `Recovered paid ticket for ${user.username || inspected.buyer} on ${game.title}.`,
  };
}

export async function reconcilePaidTicketToUserAction(
  _prevState: ReconcilePaidTicketResult | null,
  formData: FormData,
): Promise<ReconcilePaidTicketResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }
  const session = auth.session;

  const parsed = reconcilePaidTicketToUserSchema.safeParse({
    txHash: formData.get("txHash")?.toString().trim(),
    userQuery: formData.get("userQuery")?.toString().trim(),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { txHash, userQuery } = parsed.data;
  const inspected = await inspectPaidTicketPurchase(txHash);

  if (!inspected) {
    return {
      success: false,
      error:
        "No valid TicketPurchased event was found for this txHash on the supported platforms.",
    };
  }

  if (inspected.platform !== "FARCASTER") {
    return {
      success: false,
      error: "Username resolution is only supported for Farcaster purchases.",
    };
  }

  const existingByTxHash = await prisma.gameEntry.findUnique({
    where: { txHash },
    select: { id: true },
  });

  if (existingByTxHash) {
    return {
      success: true,
      entryId: existingByTxHash.id,
      message: "This purchase is already synced in the database.",
    };
  }

  const game = await prisma.game.findFirst({
    where: {
      platform: inspected.platform,
      network: inspected.network,
      onchainId: { equals: inspected.gameId, mode: "insensitive" },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      playerCount: true,
      prizePool: true,
    },
  });

  if (!game) {
    return {
      success: false,
      error: "This on-chain purchase does not map to any game in the database.",
    };
  }

  const user = await findUserForPlatform(inspected.platform, userQuery);

  if (!user) {
    return {
      success: false,
      error: "User not found on this platform.",
    };
  }

  const paidAmount = Number(inspected.amountFormatted);
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return {
      success: false,
      error: "Unable to derive a valid ticket amount from the on-chain purchase.",
    };
  }

  let result:
    | { entryId: string; playerCount: number; prizePool: number }
    | { error: string };

  try {
    result = await prisma.$transaction(async (tx) => {
      const existingEntry = await tx.gameEntry.findUnique({
        where: { gameId_userId: { gameId: game.id, userId: user.id } },
        select: { id: true, purchaseSource: true },
      });

      if (existingEntry) {
        return {
          error:
            existingEntry.purchaseSource === TicketPurchaseSource.PAID
              ? "This user already has a paid entry for the game."
              : "This user already has an entry for the game. Resolve that existing entry before reconciling this purchase.",
        };
      }

      await attachWalletToFarcasterUser(tx, user.id, inspected.buyer);

      const entry = await tx.gameEntry.create({
        data: {
          gameId: game.id,
          userId: user.id,
          txHash,
          payerWallet: inspected.buyer,
          paidAmount,
          paidAt: new Date(),
          purchaseSource: TicketPurchaseSource.PAID,
        },
        select: { id: true },
      });

      const updatedGame = await tx.game.update({
        where: { id: game.id },
        data: {
          playerCount: { increment: 1 },
          prizePool: { increment: paidAmount },
        },
        select: {
          playerCount: true,
          prizePool: true,
        },
      });

      await unlockReferralRewards(tx, user.id);

      return {
        entryId: entry.id,
        playerCount: updatedGame.playerCount,
        prizePool: updatedGame.prizePool,
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to resolve purchase.",
    };
  }

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  await logAdminAction({
    adminId: session.userId,
    action: AdminAction.MANUAL_TICKET_CREATE,
    entityType: EntityType.TICKET,
    entityId: result.entryId,
    details: {
      source: "onchain_reconcile_resolved_user",
      txHash,
      gameId: game.id,
      userId: user.id,
      userQuery,
      wallet: inspected.buyer,
      platform: inspected.platform,
      network: inspected.network,
      paidAmount,
    },
  });

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/games/${game.id}`);
  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");

  notifyTicketPurchased(game.id, {
    username: user.username || "Player",
    pfpUrl: user.pfpUrl || null,
    prizePool: result.prizePool,
    playerCount: result.playerCount,
  }).catch((error) =>
    console.error("[admin-tickets] reconcile_paid_ticket_to_user_partykit_failed", error),
  );

  if (user.hasGameAccess && !user.isBanned) {
    void import("@/lib/notifications/templates").then(
      ({ transactional, buildPayload }) => {
        const payload = buildPayload(
          transactional.ticketSecured(formatGameTime(game.startsAt)),
        );
        sendToUser(user.id, payload).catch((error) =>
          console.error("[admin-tickets] reconcile_paid_ticket_to_user_notify_failed", error),
        );
      },
    );
  }

  return {
    success: true,
    entryId: result.entryId,
    message: `Linked ${inspected.buyer} to ${user.username || user.id} and recovered the paid ticket on ${game.title}.`,
  };
}
