import { prisma } from "@/lib/db";
import { sendToFid } from "./adapters/farcaster";
import { logNotification } from "./log";
import type { NotificationPayload, SendResult } from "./types";

/**
 * Send a notification to a single user (resolves their platform automatically).
 */
export async function sendToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<SendResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platform: true, fid: true },
  });

  if (!user) return { state: "no_token" };

  let result: SendResult;

  switch (user.platform) {
    case "FARCASTER":
      if (!user.fid) {
        result = { state: "no_token" };
        break;
      }
      result = await sendToFid(user.fid, payload);
      break;
    case "MINIPAY":
    case "BASE_APP":
      result = { state: "no_token" };
      break;
  }

  if (result.state !== "no_token") {
    logNotification("single", payload, {
      recipientCount: 1,
      userId,
      success: result.state === "success" ? 1 : 0,
      failed: result.state === "error" ? 1 : 0,
      invalidTokens: result.state === "invalid_token" ? 1 : 0,
      rateLimited: result.state === "rate_limit" ? 1 : 0,
    });
  }

  return result;
}
