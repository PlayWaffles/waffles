"use server";

import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { logAdminAction, EntityType } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type AnnouncementResult =
  | { success: true; id: string }
  | { success: false; error: string };

// CTA target is stored as "screen:<name>" | "theme:<id>" (parsed client-side).
const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(140, "Title max 140 chars"),
  body: z.string().trim().min(1, "Body is required").max(1000, "Body max 1000 chars"),
  tone: z.enum(["maple", "berry", "leaf"]),
  emoji: z.string().trim().min(1, "Pick an emoji").max(8),
  ctaLabel: z.string().trim().max(60).optional(),
  ctaTarget: z.string().trim().max(120).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Date.now().toString(36).slice(-6);
  return `${base || "announcement"}-${suffix}`.slice(0, 60);
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Create an authored in-app announcement (shown in the player banner/inbox). */
export async function createAnnouncementAction(
  _prev: AnnouncementResult | null,
  formData: FormData,
): Promise<AnnouncementResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) return { success: false, error: "Unauthorized" };

  const parsed = schema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    tone: formData.get("tone"),
    emoji: formData.get("emoji"),
    ctaLabel: formData.get("ctaLabel") || undefined,
    ctaTarget: formData.get("ctaTarget") || undefined,
    sortOrder: formData.get("sortOrder") ?? 0,
    startsAt: (formData.get("startsAt") as string) || undefined,
    endsAt: (formData.get("endsAt") as string) || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  // A CTA needs both a label and a target; otherwise the card is non-interactive.
  const hasCta = Boolean(d.ctaLabel && d.ctaTarget);

  try {
    const created = await prisma.announcement.create({
      data: {
        slug: slugify(d.title),
        title: d.title,
        body: d.body,
        tone: d.tone,
        emoji: d.emoji,
        kind: "info",
        ctaLabel: hasCta ? d.ctaLabel : null,
        ctaAction: hasCta ? d.ctaTarget : null,
        sortOrder: d.sortOrder,
        startsAt: parseDate(d.startsAt),
        endsAt: parseDate(d.endsAt),
        isActive: true,
      },
      select: { id: true },
    });

    await logAdminAction({
      adminId: auth.session.userId,
      action: "CREATE_ANNOUNCEMENT",
      entityType: EntityType.SYSTEM,
      entityId: created.id,
      details: { title: d.title, tone: d.tone },
    });

    revalidatePath("/admin/announcements");
    return { success: true, id: created.id };
  } catch (e) {
    console.error("[admin] createAnnouncement failed", e);
    return { success: false, error: "Failed to create announcement" };
  }
}

/** Toggle an announcement live/paused without deleting it. */
export async function setAnnouncementActiveAction(
  id: string,
  isActive: boolean,
): Promise<AnnouncementResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) return { success: false, error: "Unauthorized" };
  try {
    await prisma.announcement.update({ where: { id }, data: { isActive } });
    await logAdminAction({
      adminId: auth.session.userId,
      action: isActive ? "ACTIVATE_ANNOUNCEMENT" : "DEACTIVATE_ANNOUNCEMENT",
      entityType: EntityType.SYSTEM,
      entityId: id,
    });
    revalidatePath("/admin/announcements");
    return { success: true, id };
  } catch {
    return { success: false, error: "Failed to update announcement" };
  }
}

/** Delete an announcement (cascades its per-user read/dismiss state). */
export async function deleteAnnouncementAction(id: string): Promise<AnnouncementResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) return { success: false, error: "Unauthorized" };
  try {
    await prisma.announcement.delete({ where: { id } });
    await logAdminAction({
      adminId: auth.session.userId,
      action: "DELETE_ANNOUNCEMENT",
      entityType: EntityType.SYSTEM,
      entityId: id,
    });
    revalidatePath("/admin/announcements");
    return { success: true, id };
  } catch {
    return { success: false, error: "Failed to delete announcement" };
  }
}
