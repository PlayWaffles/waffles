/**
 * Per-question play stats, tracked SEPARATELY per mode ("tournament" | "level").
 * Counters live in `QuestionStat` (one row per template+mode), incremented once
 * per completed play. Correct-rate = correctCount / playCount; avg answer time =
 * totalResponseMs / playCount. Writes are best-effort — a stats hiccup must
 * never break scoring or gameplay.
 */
import { prisma } from "@/lib/db";

export type QuestionMode = "tournament" | "level";
export type QuestionStatItem = { templateId: string; correct: boolean; responseMs: number };

export async function recordQuestionStats(mode: QuestionMode, items: QuestionStatItem[]): Promise<void> {
  const now = new Date();
  for (const it of items) {
    if (!it.templateId) continue;
    const ms = BigInt(Math.max(0, Math.round(it.responseMs || 0)));
    try {
      await prisma.questionStat.upsert({
        where: { templateId_mode: { templateId: it.templateId, mode } },
        create: {
          templateId: it.templateId,
          mode,
          playCount: 1,
          correctCount: it.correct ? 1 : 0,
          totalResponseMs: ms,
          lastPlayedAt: now,
        },
        update: {
          playCount: { increment: 1 },
          correctCount: { increment: it.correct ? 1 : 0 },
          totalResponseMs: { increment: ms },
          lastPlayedAt: now,
        },
      });
    } catch (e) {
      console.error(`[questionStats] ${mode} upsert failed for template ${it.templateId}:`, e);
    }
  }
}
