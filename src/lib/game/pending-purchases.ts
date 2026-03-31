import { PendingPurchaseStatus } from "../../../prisma/generated/enums";

import { prisma } from "@/lib/db";
import { finalizeTicketPurchase, type PurchaseInput } from "@/lib/game/purchase";

const MAX_ERROR_LENGTH = 500;
const MAX_PENDING_PURCHASE_ATTEMPTS = 10;

function normalizeErrorMessage(error: string) {
  return error.length > MAX_ERROR_LENGTH
    ? `${error.slice(0, MAX_ERROR_LENGTH - 3)}...`
    : error;
}

function isRetryablePurchaseError(code?: string) {
  return code === "VERIFICATION_FAILED" || code === "INTERNAL_ERROR";
}

export async function registerPendingPurchase(input: {
  txHash: string;
  userId: string;
  gameId: string;
  platform: "FARCASTER" | "MINIPAY";
  payerWallet: string;
  expectedAmount: number;
}) {
  const existing = await prisma.pendingPurchase.findUnique({
    where: { txHash: input.txHash },
    select: {
      id: true,
      userId: true,
      gameId: true,
      platform: true,
      payerWallet: true,
    },
  });

  if (
    existing &&
    (
      existing.userId !== input.userId ||
      existing.gameId !== input.gameId ||
      existing.platform !== input.platform ||
      existing.payerWallet.toLowerCase() !== input.payerWallet.toLowerCase()
    )
  ) {
    return {
      success: false as const,
      error: "This transaction is already registered to a different purchase",
      code: "INVALID_INPUT" as const,
    };
  }

  await prisma.pendingPurchase.upsert({
    where: { txHash: input.txHash },
    update: {
      expectedAmount: input.expectedAmount,
      payerWallet: input.payerWallet,
      lastError: null,
    },
    create: {
      txHash: input.txHash,
      userId: input.userId,
      gameId: input.gameId,
      platform: input.platform,
      payerWallet: input.payerWallet,
      expectedAmount: input.expectedAmount,
      status: PendingPurchaseStatus.SUBMITTED,
    },
  });

  return { success: true as const };
}

export async function processPendingPurchaseByTxHash(txHash: string) {
  const pendingPurchase = await prisma.pendingPurchase.findUnique({
    where: { txHash },
    include: {
      user: {
        select: {
          id: true,
          platform: true,
          username: true,
          pfpUrl: true,
          wallet: true,
        },
      },
    },
  });

  if (!pendingPurchase) {
    return {
      success: false as const,
      error: "Pending purchase not found",
      code: "NOT_FOUND" as const,
    };
  }

  if (pendingPurchase.status === PendingPurchaseStatus.SYNCED && pendingPurchase.syncedEntryId) {
    return {
      success: true as const,
      entryId: pendingPurchase.syncedEntryId,
    };
  }

  const purchaseInput: PurchaseInput = {
    gameId: pendingPurchase.gameId,
    txHash: pendingPurchase.txHash,
    paidAmount: pendingPurchase.expectedAmount,
    payerWallet: pendingPurchase.payerWallet,
  };

  const result = await finalizeTicketPurchase(pendingPurchase.user, purchaseInput);
  const nextAttempts = pendingPurchase.attempts + 1;

  if (result.success) {
    await prisma.pendingPurchase.update({
      where: { txHash },
      data: {
        status: PendingPurchaseStatus.SYNCED,
        syncedEntryId: result.entryId,
        syncedAt: new Date(),
        attempts: nextAttempts,
        lastError: null,
      },
    });

    return result;
  }

  await prisma.pendingPurchase.update({
    where: { txHash },
    data: {
      status: PendingPurchaseStatus.FAILED,
      attempts: isRetryablePurchaseError(result.code)
        ? nextAttempts
        : MAX_PENDING_PURCHASE_ATTEMPTS,
      lastError: normalizeErrorMessage(result.error),
    },
  });

  return result;
}

export async function processPendingPurchases(limit = 25) {
  const pendingPurchases = await prisma.pendingPurchase.findMany({
    where: {
      status: {
        in: [PendingPurchaseStatus.SUBMITTED, PendingPurchaseStatus.FAILED],
      },
      attempts: { lt: MAX_PENDING_PURCHASE_ATTEMPTS },
    },
    orderBy: [{ updatedAt: "asc" }],
    take: limit,
    select: { txHash: true },
  });

  let synced = 0;
  let failed = 0;

  for (const pendingPurchase of pendingPurchases) {
    const result = await processPendingPurchaseByTxHash(pendingPurchase.txHash);
    if (result.success) {
      synced += 1;
    } else {
      failed += 1;
    }
  }

  return {
    processed: pendingPurchases.length,
    synced,
    failed,
  };
}
