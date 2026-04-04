import { prisma } from "@/lib/db";
import { sendBatch } from "@/lib/notifications";
import { ticketOpen, buildPayload } from "@/lib/notifications/templates";
import type { UserPlatform } from "@prisma";

/**
 * Notification milestones before tickets open.
 * Ordered from earliest to latest — only the single most recent due
 * milestone is sent per cron tick to avoid notification spam.
 */
const MILESTONES = [
  { key: "3h", minutesBefore: 180, template: ticketOpen.countdown3h },
  { key: "1h", minutesBefore: 60, template: ticketOpen.countdown1h },
  { key: "30m", minutesBefore: 30, template: ticketOpen.countdown30m },
  { key: "15m", minutesBefore: 15, template: ticketOpen.countdown15m },
  { key: "5m", minutesBefore: 5, template: ticketOpen.countdown5m },
  { key: "open", minutesBefore: 0, template: ticketOpen.nowOpen },
] as const;

/**
 * Check all games with a future or just-passed ticketsOpenAt and send
 * the single next due milestone notification that hasn't been sent yet.
 *
 * Called every minute by the cron scheduler.
 */
export async function sendTicketOpenNotifications() {
  const now = new Date();

  // Find games that have a ticketsOpenAt within the widest window (3h from now)
  // or have already passed but may still need the "open" notification
  const maxWindowMs = 180 * 60 * 1000; // 3 hours
  const windowStart = new Date(now.getTime() - 5 * 60 * 1000); // 5 min grace for "open"
  const windowEnd = new Date(now.getTime() + maxWindowMs);

  const games = await prisma.game.findMany({
    where: {
      ticketsOpenAt: {
        not: null,
        gte: windowStart,
        lte: windowEnd,
      },
    },
    select: {
      id: true,
      gameNumber: true,
      platform: true,
      ticketsOpenAt: true,
      ticketOpenNotifsSent: true,
    },
  });

  if (!games.length) return;

  // Pre-fetch users by platform to avoid N+1 queries
  const platforms = [...new Set(games.map((g) => g.platform))];
  const usersByPlatform = new Map<UserPlatform, string[]>();

  await Promise.all(
    platforms.map(async (platform) => {
      const users = await prisma.user.findMany({
        where: { isBanned: false, platform },
        select: { id: true },
      });
      usersByPlatform.set(platform, users.map((u) => u.id));
    }),
  );

  for (const game of games) {
    if (!game.ticketsOpenAt) continue;

    const openMs = game.ticketsOpenAt.getTime();
    const nowMs = now.getTime();
    const minutesUntilOpen = (openMs - nowMs) / 60_000;
    const alreadySent = new Set(game.ticketOpenNotifsSent);

    // Find the single most recent milestone that is due but not yet sent.
    // Milestones are ordered earliest-first, so iterate in reverse to find
    // the closest one. This prevents sending a burst of 6 notifications
    // when the cron catches up after being down.
    let toSend: typeof MILESTONES[number] | null = null;
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      const m = MILESTONES[i];
      if (!alreadySent.has(m.key) && minutesUntilOpen <= m.minutesBefore) {
        toSend = m;
        break;
      }
    }

    if (!toSend) continue;

    const userIds = usersByPlatform.get(game.platform);
    if (!userIds?.length) continue;

    // Mark all milestones up to and including the one we're sending as sent
    // so we skip over missed ones and don't send them next tick
    const keysToMark: string[] = [];
    for (const m of MILESTONES) {
      if (!alreadySent.has(m.key) && minutesUntilOpen <= m.minutesBefore) {
        keysToMark.push(m.key);
      }
    }

    try {
      const payload = buildPayload(
        toSend.template(game.gameNumber),
        game.id,
        "pregame",
      );
      await sendBatch(payload, userIds);

      console.log("[Cron] Ticket open notification sent", {
        gameId: game.id,
        milestone: toSend.key,
        skipped: keysToMark.filter((k) => k !== toSend!.key),
        users: userIds.length,
      });
    } catch (err) {
      console.error("[Cron] Ticket open notification failed", {
        gameId: game.id,
        milestone: toSend.key,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Mark all due milestones as sent (including skipped ones)
    if (keysToMark.length > 0) {
      await prisma.game.update({
        where: { id: game.id },
        data: {
          ticketOpenNotifsSent: {
            push: keysToMark,
          },
        },
      });
    }
  }
}
