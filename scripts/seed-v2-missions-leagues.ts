/**
 * Seeds v2 daily missions (Quest rows) + league tiers.
 *
 *   node --env-file=.env --import tsx scripts/seed-v2-missions-leagues.ts
 */
const { prisma } = await import("@/lib/db");
const { QuestType, QuestCategory, RepeatFrequency } = await import("@prisma");
const { seedLeagues } = await import("@/lib/v2/leagues");

const MISSIONS = [
  { slug: "daily-answer-5", title: "Answer 5 questions in Survival", requiredCount: 5, points: 300, sortOrder: 1 },
  { slug: "daily-streak-10", title: "Topics: streak of 10 in 1 category", requiredCount: 1, points: 225, sortOrder: 2 },
  { slug: "daily-answer-3", title: "Answer 3 questions in Survival", requiredCount: 3, points: 150, sortOrder: 3 },
  { slug: "daily-win-tournament", title: "Win 1 tournament", requiredCount: 1, points: 500, sortOrder: 4 },
  { slug: "daily-play-5-days", title: "Play 5 days in a row", requiredCount: 5, points: 400, sortOrder: 5 },
];

for (const m of MISSIONS) {
  await prisma.quest.upsert({
    where: { slug: m.slug },
    create: {
      slug: m.slug,
      title: m.title,
      description: m.title,
      type: QuestType.CUSTOM,
      category: QuestCategory.ENGAGEMENT,
      repeatFrequency: RepeatFrequency.DAILY,
      points: m.points,
      requiredCount: m.requiredCount,
      sortOrder: m.sortOrder,
      isActive: true,
    },
    update: {
      title: m.title,
      description: m.title,
      points: m.points,
      requiredCount: m.requiredCount,
      sortOrder: m.sortOrder,
      category: QuestCategory.ENGAGEMENT,
      repeatFrequency: RepeatFrequency.DAILY,
    },
  });
}

const leagueCount = await seedLeagues();
const missionCount = await prisma.quest.count({ where: { category: QuestCategory.ENGAGEMENT } });
console.log(`seeded ${missionCount} daily missions, ${leagueCount} league tiers`);
await prisma.$disconnect();

export {};
