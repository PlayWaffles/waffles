import { prisma } from "@/lib/db";
import { sendBatchToFids } from "./adapters/farcaster";
import { logNotification } from "./log";
import { shouldSkipNotifications } from "./guards";
import type { BatchResult, NotificationPayload } from "./types";
import { deliverInAppNotifications } from "./send";

const EMPTY_RESULT: BatchResult = { total: 0, success: 0, failed: 0, invalidTokens: 0, rateLimited: 0, durationMs: 0 };

/**
 * Send a batch notification to a list of user IDs.
 * Resolves platforms in one query. Farcaster receives push notifications;
 * MiniPay/Base App receives targeted in-app announcement deliveries.
 */
export async function sendBatch(
  payload: NotificationPayload,
  userIds: string[],
): Promise<BatchResult> {
  if (userIds.length === 0) {
    return EMPTY_RESULT;
  }

  if (shouldSkipNotifications()) {
    console.info("[notifications] skipped batch notification in local dev", {
      recipients: userIds.length,
      title: payload.title,
    });
    return EMPTY_RESULT;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, platform: true, fid: true },
  });

  const fids = users
    .filter((u) => u.platform === "FARCASTER" && u.fid)
    .map((u) => u.fid!);
  const inAppUserIds = users
    .filter((u) => u.platform === "MINIPAY" || u.platform === "BASE_APP")
    .map((u) => u.id);

  const [pushResult, inAppResult] = await Promise.all([
    fids.length > 0 ? sendBatchToFids(payload, fids) : Promise.resolve(EMPTY_RESULT),
    deliverInAppNotifications(inAppUserIds, payload)
      .then((count) => ({ success: count, failed: 0 }))
      .catch((error) => {
        console.error("[notifications] in-app batch delivery failed:", error);
        return { success: 0, failed: inAppUserIds.length };
      }),
  ]);

  const result: BatchResult = {
    total: fids.length + inAppUserIds.length,
    success: pushResult.success + inAppResult.success,
    failed: pushResult.failed + inAppResult.failed,
    invalidTokens: pushResult.invalidTokens,
    rateLimited: pushResult.rateLimited,
    durationMs: pushResult.durationMs,
  };

  logNotification("batch", payload, {
    recipientCount: userIds.length,
    success: result.success,
    failed: result.failed,
    invalidTokens: result.invalidTokens,
    rateLimited: result.rateLimited,
    durationMs: result.durationMs,
  });

  return result;
}
