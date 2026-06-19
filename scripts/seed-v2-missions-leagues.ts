/**
 * Seeds v2 daily missions (Quest rows) + league tiers.
 *
 *   node --env-file=.env --import tsx scripts/seed-v2-missions-leagues.ts
 */
const { prisma } = await import("@/lib/db");
const { QuestType, QuestCategory, RepeatFrequency } = await import("@prisma");
const { seedLeagues } = await import("@/lib/player/leagues");

// Daily missions. `featured` = the fixed 3 shown on Home; the rest form the
// generated pool the Missions page rotates a daily slice from. `eventType` is
// the gameplay signal that advances the mission (see lib/player/missions.ts) —
// every mission here is keyed to an event that's actually emitted, so none are
// dead. `day_streak` is derived from User.currentStreak (not event-counted).
type MissionSeed = {
  slug: string;
  title: string;
  requiredCount: number;
  points: number;
  eventType: string;
  featured: boolean;
};

const FEATURED: MissionSeed[] = [
  { slug: "daily-answer-5", title: "Answer 5 questions", requiredCount: 5, points: 300, eventType: "questions_answered", featured: true },
  { slug: "daily-win-tournament", title: "Win a tournament", requiredCount: 1, points: 500, eventType: "tournaments_won", featured: true },
  { slug: "daily-play-5-days", title: "Keep a 5-day streak", requiredCount: 5, points: 400, eventType: "day_streak", featured: true },
];

const POOL: MissionSeed[] = [
  { slug: "daily-answer-3", title: "Answer 3 questions", requiredCount: 3, points: 100, eventType: "questions_answered", featured: false },
  { slug: "daily-answer-10", title: "Answer 10 questions", requiredCount: 10, points: 200, eventType: "questions_answered", featured: false },
  { slug: "daily-answer-15", title: "Answer 15 questions", requiredCount: 15, points: 280, eventType: "questions_answered", featured: false },
  { slug: "daily-answer-20", title: "Answer 20 questions", requiredCount: 20, points: 350, eventType: "questions_answered", featured: false },
  { slug: "daily-score-300", title: "Score 300 points", requiredCount: 300, points: 100, eventType: "points_scored", featured: false },
  { slug: "daily-score-500", title: "Score 500 points", requiredCount: 500, points: 150, eventType: "points_scored", featured: false },
  { slug: "daily-score-1000", title: "Score 1,000 points", requiredCount: 1000, points: 250, eventType: "points_scored", featured: false },
  { slug: "daily-score-2500", title: "Score 2,500 points", requiredCount: 2500, points: 400, eventType: "points_scored", featured: false },
  { slug: "daily-play-1-tournament", title: "Enter a tournament", requiredCount: 1, points: 150, eventType: "tournaments_played", featured: false },
  { slug: "daily-play-3-tournaments", title: "Enter 3 tournaments", requiredCount: 3, points: 300, eventType: "tournaments_played", featured: false },
  { slug: "daily-win-2-tournaments", title: "Win 2 tournaments", requiredCount: 2, points: 600, eventType: "tournaments_won", featured: false },
  { slug: "daily-play-2-games", title: "Play 2 games", requiredCount: 2, points: 120, eventType: "games_played", featured: false },
  { slug: "daily-play-3-games", title: "Play 3 games", requiredCount: 3, points: 180, eventType: "games_played", featured: false },
  { slug: "daily-play-5-games", title: "Play 5 games", requiredCount: 5, points: 250, eventType: "games_played", featured: false },
  { slug: "daily-streak-3", title: "Keep a 3-day streak", requiredCount: 3, points: 200, eventType: "day_streak", featured: false },
  // Repurposed from the old dead "streak of 10 in 1 category" (no infra) to a
  // wireable day-streak mission.
  { slug: "daily-streak-10", title: "Keep a 10-day streak", requiredCount: 10, points: 500, eventType: "day_streak", featured: false },
];

const MISSIONS: MissionSeed[] = [...FEATURED, ...POOL];

for (let i = 0; i < MISSIONS.length; i++) {
  const m = MISSIONS[i];
  const data = {
    title: m.title,
    description: m.title,
    points: m.points,
    requiredCount: m.requiredCount,
    sortOrder: i,
    category: QuestCategory.ENGAGEMENT,
    repeatFrequency: RepeatFrequency.DAILY,
    eventType: m.eventType,
    featured: m.featured,
  };
  await prisma.quest.upsert({
    where: { slug: m.slug },
    create: { slug: m.slug, type: QuestType.CUSTOM, isActive: true, ...data },
    update: data,
  });
}

const leagueCount = await seedLeagues();
const missionCount = await prisma.quest.count({ where: { category: QuestCategory.ENGAGEMENT } });
console.log(`seeded ${missionCount} daily missions, ${leagueCount} league tiers`);
await prisma.$disconnect();

export {};
