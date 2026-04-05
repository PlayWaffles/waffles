import { prisma } from "@/lib/db";
import { LOG_PREFIX } from "./constants";
import type { NotificationPayload } from "./types";

interface LogCounts {
  recipientCount: number;
  userId?: string;
  success: number;
  failed: number;
  invalidTokens: number;
  rateLimited: number;
  durationMs?: number;
}

/** Fire-and-forget write to NotificationLog. Never throws. */
export function logNotification(
  channel: "batch" | "single",
  payload: NotificationPayload,
  counts: LogCounts,
): void {
  prisma.notificationLog.create({
    data: {
      channel,
      title: payload.title,
      body: payload.body,
      targetUrl: payload.targetUrl,
      ...counts,
    },
  }).catch((err) =>
    console.error(`${LOG_PREFIX} Log failed:`, err instanceof Error ? err.message : err),
  );
}
