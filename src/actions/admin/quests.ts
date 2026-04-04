"use server";

import { prisma } from "@/lib/db";
import { QuestType, QuestCategory, RepeatFrequency } from "@prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { sendBatch } from "@/lib/notifications";
import { logAdminAction, EntityType } from "@/lib/audit";

// ============================================
// SCHEMAS
// ============================================

const createQuestSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  iconUrl: z.url().nullable().optional(),
  category: z.enum(QuestCategory),
  sortOrder: z.number().int().default(0),
  points: z.number().int().min(0),
  type: z.enum(QuestType),
  actionUrl: z.url().nullable().optional(),
  castHash: z.string().nullable().optional(),
  targetFid: z.number().int().nullable().optional(),
  requiredCount: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  startsAt: z.date().nullable().optional(),
  endsAt: z.date().nullable().optional(),
  repeatFrequency: z.enum(RepeatFrequency).default("ONCE"),
});

const updateQuestSchema = createQuestSchema.partial().extend({
  id: z.string(),
});

// ============================================
// TYPES
// ============================================

export type CreateQuestInput = z.infer<typeof createQuestSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================
// ACTIONS
// ============================================

/**
 * Create a new quest
 */
export async function createQuestAction(
  input: CreateQuestInput,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = createQuestSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  try {
    const quest = await prisma.quest.create({
      data: {
        slug: validation.data.slug,
        title: validation.data.title,
        description: validation.data.description,
        iconUrl: validation.data.iconUrl ?? null,
        category: validation.data.category,
        sortOrder: validation.data.sortOrder ?? 0,
        points: validation.data.points,
        type: validation.data.type,
        actionUrl: validation.data.actionUrl ?? null,
        castHash: validation.data.castHash ?? null,
        targetFid: validation.data.targetFid ?? null,
        requiredCount: validation.data.requiredCount ?? 1,
        isActive: validation.data.isActive ?? true,
        startsAt: validation.data.startsAt ?? null,
        endsAt: validation.data.endsAt ?? null,
        repeatFrequency: validation.data.repeatFrequency ?? "ONCE",
      },
    });

    // Send notifications to active users if quest is active
    if (quest.isActive) {
      try {
        const { growth, buildPayload } =
          await import("@/lib/notifications/templates");
        const payload = buildPayload(
          growth.newQuest(quest.title, `${quest.points} points`),
          undefined,
          "quest",
        );

        const activeUsers = await prisma.user.findMany({
          where: { isBanned: false },
          select: { id: true },
        });
        const notificationResults = await sendBatch(payload, activeUsers.map((u) => u.id));

        // Log the notification action for audit trail
        await logAdminAction({
          adminId: auth.session.userId,
          action: "SEND_QUEST_NOTIFICATION",
          entityType: EntityType.SYSTEM,
          entityId: quest.id,
          details: {
            questTitle: quest.title,
            questPoints: quest.points,
            notificationResults,
          },
        });

        console.log(
          `[QuestNotification] Sent notifications for quest "${quest.title}":`,
          notificationResults,
        );
      } catch (notificationError) {
        // Log but don't fail the quest creation
        console.error(
          "[QuestNotification] Failed to send notifications:",
          notificationError,
        );
      }
    }

    revalidatePath("/admin/quests");
    return { success: true, data: { id: quest.id } };
  } catch (error) {
    console.error("Error creating quest:", error);
    return { success: false, error: "Failed to create quest" };
  }
}

/**
 * Update an existing quest
 */
export async function updateQuestAction(
  input: UpdateQuestInput,
): Promise<ActionResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = updateQuestSchema.safeParse(input);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { id, ...data } = validation.data;

  try {
    await prisma.quest.update({
      where: { id },
      data: {
        ...(data.slug && { slug: data.slug }),
        ...(data.title && { title: data.title }),
        ...(data.description && { description: data.description }),
        ...(data.iconUrl !== undefined && { iconUrl: data.iconUrl }),
        ...(data.category && { category: data.category }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.points !== undefined && { points: data.points }),
        ...(data.type && { type: data.type }),
        ...(data.actionUrl !== undefined && { actionUrl: data.actionUrl }),
        ...(data.castHash !== undefined && { castHash: data.castHash }),
        ...(data.targetFid !== undefined && { targetFid: data.targetFid }),
        ...(data.requiredCount !== undefined && {
          requiredCount: data.requiredCount,
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
        ...(data.repeatFrequency && { repeatFrequency: data.repeatFrequency }),
      },
    });

    revalidatePath("/admin/quests");
    return { success: true };
  } catch (error) {
    console.error("Error updating quest:", error);
    return { success: false, error: "Failed to update quest" };
  }
}

/**
 * Delete a quest
 */
export async function deleteQuestAction(id: string): Promise<ActionResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.quest.delete({
      where: { id },
    });

    revalidatePath("/admin/quests");
    return { success: true };
  } catch (error) {
    console.error("Error deleting quest:", error);
    return { success: false, error: "Failed to delete quest" };
  }
}

/**
 * Toggle quest active status
 */
export async function toggleQuestActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.quest.update({
      where: { id },
      data: { isActive },
    });

    revalidatePath("/admin/quests");
    return { success: true };
  } catch (error) {
    console.error("Error toggling quest:", error);
    return { success: false, error: "Failed to toggle quest" };
  }
}

/**
 * Approve a pending custom quest completion
 */
export async function approveQuestCompletionAction(
  completedQuestId: string,
): Promise<ActionResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const completedQuest = await prisma.completedQuest.findUnique({
      where: { id: completedQuestId },
      select: { id: true, isApproved: true },
    });

    if (!completedQuest) {
      return { success: false, error: "Completion not found" };
    }

    if (completedQuest.isApproved) {
      return { success: false, error: "Already approved" };
    }

    await prisma.completedQuest.update({
      where: { id: completedQuestId },
      data: {
        isApproved: true,
        approvedBy: auth.session.userId,
        approvedAt: new Date(),
      },
    });

    revalidatePath("/admin/quests");
    return { success: true };
  } catch (error) {
    console.error("Error approving quest completion:", error);
    return { success: false, error: "Failed to approve" };
  }
}

/**
 * Reject a pending custom quest completion
 */
export async function rejectQuestCompletionAction(
  completedQuestId: string,
): Promise<ActionResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.completedQuest.delete({
      where: { id: completedQuestId },
    });

    revalidatePath("/admin/quests");
    return { success: true };
  } catch (error) {
    console.error("Error rejecting quest completion:", error);
    return { success: false, error: "Failed to reject" };
  }
}
