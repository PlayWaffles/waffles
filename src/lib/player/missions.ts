/**
 * v2 daily missions — backed by the existing Quest / QuestProgress / CompletedQuest
 * models. Daily missions are `Quest` rows (category ENGAGEMENT, repeatFrequency
 * DAILY); per-user progress lives in `QuestProgress`. A mission becomes
 * *claimable* once `QuestProgress.count` reaches `requiredCount`; the player then
 * explicitly claims it, which writes the `CompletedQuest` row and awards XP. So
 * `CompletedQuest` means "claimed" (not merely "reached"). The partner-offer tab
 * stays static (external sponsored offers).
 */
import { prisma } from "@/lib/db";
import { QuestCategory, RepeatFrequency } from "@prisma";

export type Mission = {
  slug: string;
  title: string;
  count: number; // current progress
  total: number; // requiredCount
  xp: number;
  done: boolean; // claimed (XP awarded)
  claimable: boolean; // reached requiredCount but not yet claimed
  icon: string; // client asset key (mapped in the screen)
};

export type ClaimMissionResult =
  | { ok: true; xpAwarded: number; xp: number }
  | { ok: false; error: "not_found" | "not_complete" | "already_claimed" };

// Asset key per mission slug (the screen maps these to ASSETS.*).
const ICON_BY_SLUG: Record<string, string> = {
  "daily-answer-5": "iconTarget",
  "daily-streak-10": "flame",
  "daily-answer-3": "iconTarget",
  "daily-win-tournament": "trophy",
  "daily-play-5-days": "iconCalendar",
};

export async function loadMissions(userId: string): Promise<Mission[]> {
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
    const claimed = doneSet.has(q.id);
    const rawCount = Math.min(countById.get(q.id) ?? 0, q.requiredCount);
    const claimable = !claimed && rawCount >= q.requiredCount;
    return {
      slug: q.slug,
      title: q.title,
      count: claimed ? q.requiredCount : rawCount,
      total: q.requiredCount,
      xp: q.points,
      done: claimed,
      claimable,
      icon: ICON_BY_SLUG[q.slug] ?? "iconTarget",
    };
  });
}

/**
 * Advance a mission's progress for a user. Stops once the mission is already
 * claimed; reaching `requiredCount` makes it *claimable* (XP is awarded only on
 * an explicit `claimMission`, not here). Called from gameplay events.
 */
export async function recordMissionProgress(userId: string, slug: string, n = 1): Promise<void> {
  const quest = await prisma.quest.findUnique({
    where: { slug },
    select: { id: true, requiredCount: true },
  });
  if (!quest) return;

  await prisma.$transaction(async (tx) => {
    const already = await tx.completedQuest.findUnique({
      where: { userId_questId: { userId, questId: quest.id } },
      select: { id: true },
    });
    if (already) return; // already claimed today — nothing more to track

    await tx.questProgress.upsert({
      where: { userId_questId: { userId, questId: quest.id } },
      create: { userId, questId: quest.id, count: Math.min(n, quest.requiredCount) },
      update: { count: { increment: n } },
    });
  });
}

/**
 * Claim a completed mission: writes the `CompletedQuest` row and awards XP, once.
 * Guards against claiming an incomplete or already-claimed mission.
 */
export async function claimMission(userId: string, slug: string): Promise<ClaimMissionResult> {
  const quest = await prisma.quest.findUnique({
    where: { slug },
    select: { id: true, requiredCount: true, points: true },
  });
  if (!quest) return { ok: false, error: "not_found" };

  return prisma.$transaction(async (tx): Promise<ClaimMissionResult> => {
    const already = await tx.completedQuest.findUnique({
      where: { userId_questId: { userId, questId: quest.id } },
      select: { id: true },
    });
    if (already) return { ok: false, error: "already_claimed" };

    const prog = await tx.questProgress.findUnique({
      where: { userId_questId: { userId, questId: quest.id } },
      select: { count: true },
    });
    if (!prog || prog.count < quest.requiredCount) return { ok: false, error: "not_complete" };

    await tx.completedQuest.create({
      data: { userId, questId: quest.id, pointsAwarded: quest.points },
    });
    const updated = await tx.user.update({
      where: { id: userId },
      data: { xp: { increment: quest.points } },
      select: { xp: true },
    });
    return { ok: true, xpAwarded: quest.points, xp: updated.xp };
  });
}
