/**
 * v2 daily missions — backed by the existing Quest / QuestProgress / CompletedQuest
 * models. Daily missions are `Quest` rows (category ENGAGEMENT, repeatFrequency
 * DAILY); per-user progress lives in `QuestProgress`; completion + XP award in
 * `CompletedQuest`. The partner-offer tab stays static (external sponsored offers).
 */
import { prisma } from "@/lib/db";
import { QuestCategory, RepeatFrequency } from "@prisma";

export type V2Mission = {
  slug: string;
  title: string;
  count: number; // current progress
  total: number; // requiredCount
  xp: number;
  done: boolean;
  icon: string; // client asset key (mapped in the screen)
};

// Asset key per mission slug (the screen maps these to ASSETS.*).
const ICON_BY_SLUG: Record<string, string> = {
  "daily-answer-5": "iconTarget",
  "daily-streak-10": "flame",
  "daily-answer-3": "iconTarget",
  "daily-win-tournament": "trophy",
  "daily-play-5-days": "iconCalendar",
};

export async function loadMissions(userId: string): Promise<V2Mission[]> {
  const quests = await prisma.quest.findMany({
    where: { category: QuestCategory.ENGAGEMENT, repeatFrequency: RepeatFrequency.DAILY, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, title: true, points: true, requiredCount: true },
  });
  if (quests.length === 0) return [];

  const [progress, completed] = await Promise.all([
    prisma.questProgress.findMany({
      where: { userId, questId: { in: quests.map((q) => q.id) } },
      select: { questId: true, count: true },
    }),
    prisma.completedQuest.findMany({
      where: { userId, questId: { in: quests.map((q) => q.id) } },
      select: { questId: true },
    }),
  ]);
  const countById = new Map(progress.map((p) => [p.questId, p.count]));
  const doneSet = new Set(completed.map((c) => c.questId));

  return quests.map((q) => {
    const done = doneSet.has(q.id);
    const count = done ? q.requiredCount : Math.min(countById.get(q.id) ?? 0, q.requiredCount);
    return {
      slug: q.slug,
      title: q.title,
      count,
      total: q.requiredCount,
      xp: q.points,
      done,
      icon: ICON_BY_SLUG[q.slug] ?? "iconTarget",
    };
  });
}

/**
 * Advance a mission's progress for a user. When it reaches requiredCount, mark it
 * complete and award its XP (once). Called from gameplay events.
 */
export async function recordMissionProgress(userId: string, slug: string, n = 1): Promise<void> {
  const quest = await prisma.quest.findUnique({
    where: { slug },
    select: { id: true, requiredCount: true, points: true },
  });
  if (!quest) return;

  await prisma.$transaction(async (tx) => {
    const already = await tx.completedQuest.findUnique({
      where: { userId_questId: { userId, questId: quest.id } },
      select: { id: true },
    });
    if (already) return; // already done today

    const prog = await tx.questProgress.upsert({
      where: { userId_questId: { userId, questId: quest.id } },
      create: { userId, questId: quest.id, count: Math.min(n, quest.requiredCount) },
      update: { count: { increment: n } },
      select: { count: true },
    });

    if (prog.count >= quest.requiredCount) {
      await tx.completedQuest.create({
        data: { userId, questId: quest.id, pointsAwarded: quest.points },
      });
      await tx.user.update({ where: { id: userId }, data: { xp: { increment: quest.points } } });
    }
  });
}
