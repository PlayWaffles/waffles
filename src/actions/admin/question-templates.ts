"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { logAdminAction, AdminAction, EntityType } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { GameTheme, Difficulty } from "@prisma";
import { recalculateGameRounds } from "@/lib/game/rounds";

// ==========================================
// SCHEMAS
// ==========================================

const TemplateSchema = z.object({
  content: z.string().min(5, "Question content must be at least 5 characters"),
  optionA: z.string().min(1, "Option A is required"),
  optionB: z.string().min(1, "Option B is required"),
  optionC: z.string().min(1, "Option C is required"),
  optionD: z.string().min(1, "Option D is required"),
  correctAnswer: z.enum(["A", "B", "C", "D"]),
  durationSec: z.coerce.number().min(5).max(60).default(10),
  theme: z.enum(GameTheme).default(GameTheme.GENERAL),
  difficulty: z.enum(Difficulty).default(Difficulty.MEDIUM),
  mediaUrl: z.string().optional(),
  soundUrl: z.string().optional(),
});

// ==========================================
// TYPES
// ==========================================

export type TemplateActionResult =
  | { success: true; templateId?: string }
  | { success: false; error: string };

export type AssignResult =
  | { success: true; added: number; skipped: number }
  | { success: false; error: string };

export interface TemplateFilters {
  theme?: GameTheme;
  difficulty?: Difficulty;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface TemplateListResult {
  templates: Array<{
    id: string;
    content: string;
    options: string[];
    correctIndex: number;
    durationSec: number;
    theme: GameTheme;
    difficulty: Difficulty;
    usageCount: number;
    mediaUrl: string | null;
    soundUrl: string | null;
    createdAt: Date;
  }>;
  nextCursor: string | null;
  totalCount: number;
}

// ==========================================
// CREATE TEMPLATE
// ==========================================

export async function createTemplateAction(
  _prevState: TemplateActionResult | null,
  formData: FormData,
): Promise<TemplateActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const rawData = {
    content: formData.get("content"),
    optionA: formData.get("optionA"),
    optionB: formData.get("optionB"),
    optionC: formData.get("optionC"),
    optionD: formData.get("optionD"),
    correctAnswer: formData.get("correctAnswer"),
    durationSec: formData.get("durationSec") || "10",
    theme: formData.get("theme") || "GENERAL",
    difficulty: formData.get("difficulty") || "MEDIUM",
    mediaUrl: formData.get("mediaUrl"),
    soundUrl: formData.get("soundUrl"),
  };

  const validation = TemplateSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validation.data;
  const correctIndex = data.correctAnswer.charCodeAt(0) - 65;

  try {
    const template = await prisma.questionTemplate.create({
      data: {
        content: data.content,
        options: [data.optionA, data.optionB, data.optionC, data.optionD],
        correctIndex,
        durationSec: data.durationSec,
        theme: data.theme,
        difficulty: data.difficulty,
        mediaUrl: data.mediaUrl || null,
        soundUrl: data.soundUrl || null,
      },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.CREATE_QUESTION,
      entityType: EntityType.QUESTION,
      entityId: template.id,
      details: {
        type: "template",
        theme: data.theme,
        difficulty: data.difficulty,
      },
    });

    revalidatePath("/admin/questions");

    return { success: true, templateId: template.id };
  } catch (error) {
    console.error("Create template error:", error);
    return { success: false, error: "Failed to create template" };
  }
}

// ==========================================
// UPDATE TEMPLATE
// ==========================================

export async function updateTemplateAction(
  templateId: string,
  _prevState: TemplateActionResult | null,
  formData: FormData,
): Promise<TemplateActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const rawData = {
    content: formData.get("content"),
    optionA: formData.get("optionA"),
    optionB: formData.get("optionB"),
    optionC: formData.get("optionC"),
    optionD: formData.get("optionD"),
    correctAnswer: formData.get("correctAnswer"),
    durationSec: formData.get("durationSec") || "10",
    theme: formData.get("theme") || "GENERAL",
    difficulty: formData.get("difficulty") || "MEDIUM",
    mediaUrl: formData.get("mediaUrl"),
    soundUrl: formData.get("soundUrl"),
  };

  const validation = TemplateSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validation.data;
  const correctIndex = data.correctAnswer.charCodeAt(0) - 65;

  try {
    await prisma.questionTemplate.update({
      where: { id: templateId },
      data: {
        content: data.content,
        options: [data.optionA, data.optionB, data.optionC, data.optionD],
        correctIndex,
        durationSec: data.durationSec,
        theme: data.theme,
        difficulty: data.difficulty,
        mediaUrl: data.mediaUrl || null,
        soundUrl: data.soundUrl || null,
      },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.UPDATE_GAME, // Using UPDATE_GAME as proxy
      entityType: EntityType.QUESTION,
      entityId: templateId,
      details: { type: "template_update" },
    });

    revalidatePath("/admin/questions");
    revalidatePath(`/admin/questions/${templateId}`);

    return { success: true, templateId };
  } catch (error) {
    console.error("Update template error:", error);
    return { success: false, error: "Failed to update template" };
  }
}

// ==========================================
// DELETE TEMPLATE
// ==========================================

export async function deleteTemplateAction(
  templateId: string,
): Promise<TemplateActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const template = await prisma.questionTemplate.findUnique({
      where: { id: templateId },
      select: { usageCount: true },
    });

    if (!template) {
      return { success: false, error: "Template not found" };
    }

    await prisma.questionTemplate.delete({
      where: { id: templateId },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.DELETE_QUESTION,
      entityType: EntityType.QUESTION,
      entityId: templateId,
      details: { type: "template_delete", usageCount: template.usageCount },
    });

    revalidatePath("/admin/questions");

    return { success: true };
  } catch (error) {
    console.error("Delete template error:", error);
    return { success: false, error: "Failed to delete template" };
  }
}

// ==========================================
// LIST TEMPLATES (Paginated)
// ==========================================

export async function getTemplatesAction(
  filters: TemplateFilters = {},
): Promise<TemplateListResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated) {
    return { templates: [], nextCursor: null, totalCount: 0 };
  }

  const limit = Math.min(filters.limit || 20, 100);

  // Build where clause
  const where: Record<string, unknown> = {};

  if (filters.theme) {
    where.theme = filters.theme;
  }

  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }

  if (filters.search) {
    where.content = {
      contains: filters.search,
      mode: "insensitive",
    };
  }

  try {
    // Get total count for UI
    const totalCount = await prisma.questionTemplate.count({ where });

    // Cursor-based pagination
    const templates = await prisma.questionTemplate.findMany({
      where,
      take: limit + 1, // Fetch one extra to determine if there's a next page
      orderBy: { createdAt: "desc" },
      ...(filters.cursor && {
        cursor: { id: filters.cursor },
        skip: 1,
      }),
    });

    // Determine next cursor
    let nextCursor: string | null = null;
    if (templates.length > limit) {
      const nextItem = templates.pop();
      nextCursor = nextItem?.id || null;
    }

    return {
      templates,
      nextCursor,
      totalCount,
    };
  } catch (error) {
    console.error("Get templates error:", error);
    return { templates: [], nextCursor: null, totalCount: 0 };
  }
}

// ==========================================
// ASSIGN TEMPLATES TO GAME (Transaction)
// ==========================================

export async function assignToGameAction(
  gameId: string,
  templateIds: string[],
): Promise<AssignResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  if (!templateIds.length) {
    return { success: false, error: "No templates selected" };
  }

  try {
    // 1. Validate game exists and is editable
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        questions: { select: { templateId: true, roundIndex: true } },
      },
    });

    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.endsAt <= new Date()) {
      return { success: false, error: "Cannot add questions to an ended game" };
    }

    // 2. Find templates already in this game to skip duplicates
    const existingTemplateIds = new Set(
      game.questions
        .filter((q) => q.templateId)
        .map((q) => q.templateId as string),
    );

    const newTemplateIds = templateIds.filter(
      (id) => !existingTemplateIds.has(id),
    );
    const skipped = templateIds.length - newTemplateIds.length;

    if (newTemplateIds.length === 0) {
      return {
        success: true,
        added: 0,
        skipped,
      };
    }

    // 3. Execute in transaction
    await prisma.$transaction(async (tx) => {
      // Fetch templates
      const templates = await tx.questionTemplate.findMany({
        where: { id: { in: newTemplateIds } },
      });

      if (templates.length !== newTemplateIds.length) {
        throw new Error("Some templates not found");
      }

      // Create questions from templates with placeholder rounds
      // Rounds will be recalculated after the transaction
      await tx.question.createMany({
        data: templates.map((t, idx) => ({
          gameId,
          content: t.content,
          options: t.options,
          correctIndex: t.correctIndex,
          durationSec: t.durationSec,
          mediaUrl: t.mediaUrl,
          soundUrl: t.soundUrl,
          roundIndex: 1, // Placeholder, will be recalculated
          orderInRound: game.questions.length + idx,
          templateId: t.id,
        })),
      });

      // Batch update usage counts
      await tx.questionTemplate.updateMany({
        where: { id: { in: newTemplateIds } },
        data: { usageCount: { increment: 1 } },
      });
    });

    // Recalculate round distribution for all questions
    await recalculateGameRounds(gameId);

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.CREATE_QUESTION,
      entityType: EntityType.GAME,
      entityId: gameId,
      details: {
        type: "assign_templates",
        added: newTemplateIds.length,
        skipped,
      },
    });

    revalidatePath(`/admin/games/${gameId}/questions`);
    revalidatePath("/admin/questions");

    return {
      success: true,
      added: newTemplateIds.length,
      skipped,
    };
  } catch (error) {
    console.error("Assign templates error:", error);
    return { success: false, error: "Failed to assign templates to game" };
  }
}

// ==========================================
// BULK IMPORT TEMPLATES
// ==========================================

export interface BulkTemplateInput {
  content: string;
  options: string[];
  correctIndex: number;
  durationSec: number;
  theme?: GameTheme;
  difficulty?: Difficulty;
  mediaUrl?: string;
  soundUrl?: string;
  roundIndex?: number;
}

export type BulkImportTemplateResult =
  | { success: true; imported: number; skipped: number }
  | { success: false; error: string };

export async function bulkImportTemplatesAction(
  templates: BulkTemplateInput[],
): Promise<BulkImportTemplateResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  if (!templates.length) {
    return { success: false, error: "No templates provided" };
  }

  try {
    let imported = 0;
    let skipped = 0;

    // Process in batches of 50 for large imports
    const BATCH_SIZE = 50;

    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
      const batch = templates.slice(i, i + BATCH_SIZE);

      const validTemplates = batch.filter((t) => {
        if (!t.content || t.content.length < 5) return false;
        if (!t.options || t.options.length < 2) return false;
        if (t.correctIndex < 0 || t.correctIndex >= t.options.length)
          return false;
        return true;
      });

      skipped += batch.length - validTemplates.length;

      if (validTemplates.length > 0) {
        await prisma.questionTemplate.createMany({
          data: validTemplates.map((t) => ({
            content: t.content,
            options: t.options,
            correctIndex: t.correctIndex,
            durationSec: t.durationSec || 10,
            theme: t.theme || GameTheme.GENERAL,
            difficulty: t.difficulty || Difficulty.MEDIUM,
            mediaUrl: t.mediaUrl || null,
            soundUrl: t.soundUrl || null,
          })),
        });

        imported += validTemplates.length;
      }
    }

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.CREATE_QUESTION,
      entityType: EntityType.QUESTION,
      entityId: "bulk",
      details: { type: "bulk_import_templates", imported, skipped },
    });

    revalidatePath("/admin/questions");

    return { success: true, imported, skipped };
  } catch (error) {
    console.error("Bulk import templates error:", error);
    return { success: false, error: "Failed to import templates" };
  }
}
