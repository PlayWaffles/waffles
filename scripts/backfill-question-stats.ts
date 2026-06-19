/**
 * One-off: backfill QuestionStat (mode "tournament") from historical
 * GameEntry.answers. Aggregates every recorded per-question result across all
 * entries, maps the per-game Question id → templateId, and SETS the counters
 * (idempotent — recomputes from source, safe to re-run, but run it BEFORE much
 * new live play accumulates or those increments will be overwritten).
 *
 * Levels have no historical server record, so there's nothing to backfill there.
 *
 *   DATABASE_URL=... node --import tsx scripts/backfill-question-stats.ts
 */
const { prisma } = await import("@/lib/db");

// Per-game Question id → templateId (only questions that came from a template).
const questions = await prisma.question.findMany({
  where: { templateId: { not: null } },
  select: { id: true, templateId: true },
});
const qToTemplate = new Map(questions.map((q) => [q.id, q.templateId as string]));
console.log(`loaded ${qToTemplate.size} template-backed game questions`);

type Tally = { play: number; correct: number; ms: bigint };
const tallies = new Map<string, Tally>();

const entries = await prisma.gameEntry.findMany({
  where: { answered: { gt: 0 } },
  select: { answers: true },
});
console.log(`scanning ${entries.length} answered entries`);

for (const e of entries) {
  const answers = (e.answers ?? {}) as Record<string, { correct?: boolean; ms?: number }>;
  for (const [qid, a] of Object.entries(answers)) {
    const templateId = qToTemplate.get(qid);
    if (!templateId || !a) continue;
    const t = tallies.get(templateId) ?? { play: 0, correct: 0, ms: 0n };
    t.play += 1;
    t.correct += a.correct ? 1 : 0;
    t.ms += BigInt(Math.max(0, Math.round(a.ms ?? 0)));
    tallies.set(templateId, t);
  }
}
console.log(`computed stats for ${tallies.size} templates`);

let written = 0;
for (const [templateId, t] of tallies) {
  await prisma.questionStat.upsert({
    where: { templateId_mode: { templateId, mode: "tournament" } },
    create: { templateId, mode: "tournament", playCount: t.play, correctCount: t.correct, totalResponseMs: t.ms, lastPlayedAt: new Date() },
    update: { playCount: t.play, correctCount: t.correct, totalResponseMs: t.ms },
  });
  written++;
}
console.log(`backfilled ${written} QuestionStat rows (mode=tournament)`);
await prisma.$disconnect();
export {};
