import { prisma } from "@/lib/db";
import { sendToFid } from "./adapters/farcaster";
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

  switch (user.platform) {
    case "FARCASTER":
      if (!user.fid) return { state: "no_token" };
      return sendToFid(user.fid, payload);
    case "MINIPAY":
      return { state: "no_token" };
  }
}
