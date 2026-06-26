import { prisma } from "@/lib/db";
import { sendToFid } from "./adapters/farcaster";
import { logNotification } from "./log";
import { shouldSkipNotifications } from "./guards";
import type { NotificationPayload, SendResult } from "./types";
import { Prisma } from "@prisma";
import crypto from "node:crypto";
import { mapDbAnnouncement } from "@/lib/player/announcements";
import { deliverAnnouncementToUsers } from "@/lib/realtime/announcementDelivery";

function notificationSlug(payload: NotificationPayload) {
  const seed = payload.notificationId ?? `${Date.now()}-${crypto.randomUUID()}`;
  const clean = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const hash = crypto
    .createHash("sha256")
    .update(`${seed}:${payload.title}:${payload.body}:${payload.targetUrl}`)
    .digest("hex")
    .slice(0, 12);
  return `notif-${(clean || "message").slice(0, 40)}-${hash}`.slice(0, 60);
}

function notificationCtaAction(targetUrl: string) {
  try {
    const path = new URL(targetUrl).pathname;
    return path.includes("result") ? "screen:profile" : "screen:home";
  } catch {
    return "screen:home";
  }
}

export async function deliverInAppNotifications(
  userIds: string[],
  payload: NotificationPayload,
  // `toast: false` → bell inbox only, no transient toast. The presentation
  // overrides let a caller theme the inbox card (e.g. a badge unlock uses 🏅 and
  // a "View" CTA to the profile). Omitting any field keeps the generic defaults.
  opts: { toast?: boolean; emoji?: string; tone?: string; ctaLabel?: string; ctaAction?: string } = {},
): Promise<number> {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) return 0;
  const slug = notificationSlug(payload);
  const ctaAction = opts.ctaAction ?? notificationCtaAction(payload.targetUrl);
  const ctaLabel = opts.ctaLabel ?? "Open";

  const result = await prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.upsert({
      where: { slug },
      create: {
        slug,
        title: payload.title,
        body: payload.body,
        ctaLabel,
        ctaAction,
        kind: "notification",
        tone: opts.tone ?? "maple",
        emoji: opts.emoji ?? "🔔",
        isActive: true,
        sortOrder: 90,
      },
      update: {
        title: payload.title,
        body: payload.body,
        ctaLabel,
        ctaAction,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        body: true,
        ctaLabel: true,
        ctaAction: true,
        tone: true,
        emoji: true,
        startsAt: true,
        endsAt: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    const values = uniqueUserIds.map((userId) =>
      Prisma.sql`(${crypto.randomUUID()}, ${userId}, ${announcement.id})`,
    );

    await tx.$executeRaw`
      INSERT INTO "AnnouncementRecipient" ("id", "userId", "announcementId")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("userId", "announcementId") DO NOTHING
    `;
    return { count: uniqueUserIds.length, announcement: mapDbAnnouncement(announcement) };
  });

  await deliverAnnouncementToUsers(uniqueUserIds, result.announcement, { toast: opts.toast });
  return result.count;
}

/**
 * Send a notification to a single user (resolves their platform automatically).
 */
export async function sendToUser(
  userId: string,
  payload: NotificationPayload,
): Promise<SendResult> {
  if (shouldSkipNotifications()) {
    console.info("[notifications] skipped single notification in local dev", {
      userId,
      title: payload.title,
    });
    return { state: "no_token" };
  }

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
      try {
        await deliverInAppNotifications([userId], payload);
        result = { state: "success" };
      } catch (error) {
        result = { state: "error", error };
      }
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
