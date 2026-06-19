/**
 * One-time "World Cup is here" season takeover modal.
 *
 * The "already seen" state is DB-backed (AnnouncementState), mirroring
 * migrationNotice.ts — so it's cross-device and survives reinstalls, unlike the
 * old localStorage gate. Shown to everyone once (the World Cup is the default
 * season, not opt-in); the announcement bell CTA can reopen it anytime.
 *
 * Backed by a dedicated, feed-excluded `world-cup-takeover` Announcement row
 * (kind "takeover") — distinct from the `world-cup-season` banner so dismissing
 * the banner and seeing the takeover don't share state.
 */
import { prisma } from "@/lib/db";

export const WC_TAKEOVER_SLUG = "world-cup-takeover";

/** Whether to auto-show the World Cup takeover to this user (not yet seen). */
export async function getWorldCupTakeoverNotice(userId: string): Promise<{ show: boolean }> {
  const ann = await prisma.announcement.findUnique({
    where: { slug: WC_TAKEOVER_SLUG },
    select: { id: true },
  });
  if (!ann) return { show: false };

  const state = await prisma.announcementState.findUnique({
    where: { userId_announcementId: { userId, announcementId: ann.id } },
    select: { dismissedAt: true },
  });
  return { show: !state?.dismissedAt };
}

/** Mark the World Cup takeover seen/dismissed for this user (idempotent). */
export async function dismissWorldCupTakeover(userId: string): Promise<void> {
  const ann = await prisma.announcement.findUnique({
    where: { slug: WC_TAKEOVER_SLUG },
    select: { id: true },
  });
  if (!ann) return;
  await prisma.announcementState.upsert({
    where: { userId_announcementId: { userId, announcementId: ann.id } },
    create: { userId, announcementId: ann.id, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });
}
