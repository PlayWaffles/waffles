import { prisma } from "@/lib/db";
import { sendBatchToFids } from "./adapters/farcaster";
import type { BatchResult, NotificationPayload } from "./types";

/**
 * Send a batch notification to a list of user IDs.
 * Resolves platform + fid in a single query, then dispatches to Farcaster adapter.
 * MiniPay users are filtered out (no notification channel).
 */
export async function sendBatch(
  payload: NotificationPayload,
  userIds: string[],
): Promise<BatchResult> {
  if (userIds.length === 0) {
    return { total: 0, success: 0, failed: 0, invalidTokens: 0, rateLimited: 0, durationMs: 0 };
  }

  // Single query: fetch only Farcaster users with fids (MiniPay has no notifications)
  const farcasterUsers = await prisma.user.findMany({
    where: { id: { in: userIds }, platform: "FARCASTER", fid: { not: null } },
    select: { fid: true },
  });

  const fids = farcasterUsers.map((u) => u.fid!);
  return sendBatchToFids(payload, fids);
}
