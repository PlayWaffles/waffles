/**
 * Seeds the question bank from the ported v2 prototype (src/app/v2/_app/data)
 * into the `QuestionTemplate` table so live games draw real content.
 * Idempotent: clears existing templates, then re-inserts.
 *
 *   DATABASE_URL='…' node --import tsx scripts/seed-v2-questions.ts
 */
const { prisma } = await import("@/lib/db");
const { GameTheme, Difficulty, QuestionKind } = await import("@prisma");
const { QUESTION_BANK } = await import("@/app/v2/_app/data/questions");

const THEME_BY_CATEGORY: Record<string, (typeof GameTheme)[keyof typeof GameTheme]> = {
  Movies: GameTheme.MOVIES,
  Anime: GameTheme.ANIME,
  Politics: GameTheme.POLITICS,
  Crypto: GameTheme.CRYPTO,
};
const DIFF: Record<string, (typeof Difficulty)[keyof typeof Difficulty]> = {
  easy: Difficulty.EASY,
  medium: Difficulty.MEDIUM,
  hard: Difficulty.HARD,
};

function themeFor(q: { pack?: string; category: string }) {
  if (q.pack === "world-cup") return GameTheme.FOOTBALL;
  return THEME_BY_CATEGORY[q.category] ?? GameTheme.GENERAL;
}

const data = QUESTION_BANK.map((q) => ({
  content: q.question,
  options: [...q.answers],
  correctIndex: q.correctIndex,
  durationSec: 10,
  theme: themeFor(q),
  category: q.category, // preserve the bank's fine-grained category verbatim
  difficulty: DIFF[q.difficulty],
  kind: QuestionKind.SINGLE,
}));

const cleared = await prisma.questionTemplate.deleteMany({});
const res = await prisma.questionTemplate.createMany({ data });
console.log(`cleared ${cleared.count}, seeded ${res.count} QuestionTemplates`);

const byTheme = await prisma.questionTemplate.groupBy({ by: ["theme"], _count: true });
console.log("by theme:", byTheme.map((t) => `${t.theme}=${t._count}`).join("  "));

await prisma.$disconnect();

export {};
