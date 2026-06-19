/**
 * One-time "welcome to v2" modal for users who were migrated from the old app.
 *
 * Shown to users who existed BEFORE the migration (created on/before the cutover)
 * and haven't dismissed it. Dismissal persists to `AnnouncementState` (DB) so it's
 * cross-device and survives reinstalls — not localStorage. New v2 signups never
 * see it.
 */
import { prisma } from "@/lib/db";

// Anyone created strictly before this is "migrated". Set to the migration deploy
// date — currently end of 2026-06-17 (i.e. everyone created today or earlier).
export const V2_MIGRATION_CUTOVER_AT = new Date("2026-06-18T00:00:00.000Z");

export const MIGRATION_NOTICE_SLUG = "v2-migration-welcome";

/** Whether to show the migration welcome modal to this user. */
export async function getMigrationNotice(userId: string): Promise<{ show: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });
  if (!user || user.createdAt >= V2_MIGRATION_CUTOVER_AT) return { show: false };

  const ann = await prisma.announcement.findUnique({
    where: { slug: MIGRATION_NOTICE_SLUG },
    select: { id: true },
  });
  if (!ann) return { show: false };

  const state = await prisma.announcementState.findUnique({
    where: { userId_announcementId: { userId, announcementId: ann.id } },
    select: { dismissedAt: true },
  });
  return { show: !state?.dismissedAt };
}

/** Mark the migration welcome modal dismissed (idempotent). */
export async function dismissMigrationNotice(userId: string): Promise<void> {
  const ann = await prisma.announcement.findUnique({
    where: { slug: MIGRATION_NOTICE_SLUG },
    select: { id: true },
  });
  if (!ann) return;
  await prisma.announcementState.upsert({
    where: { userId_announcementId: { userId, announcementId: ann.id } },
    create: { userId, announcementId: ann.id, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });
}
