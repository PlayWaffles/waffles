/**
 * Applies a GPT duplicate-audit report to QuestionTemplate.factKey.
 *
 * Run after the `question_fact_keys` migration:
 *
 *   QUESTION_DUPLICATE_REPORT=/private/tmp/waffles-question-audit/gpt-duplicate-report.json \
 *   bun --env-file=.env --import tsx scripts/apply-question-fact-keys.ts
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { normalizeFactKey, seedFactKey } from "@/lib/questions/fact-key";

type ReportQuestion = {
  id: string;
  kind: string;
  prompt: string;
  options: string[];
  answer: string | null;
  theme: string;
  category: string | null;
  difficulty: string;
};

type ReportGroup = {
  questions: ReportQuestion[];
};

type DuplicateReport = {
  groups: ReportGroup[];
};

function groupFactKey(group: ReportGroup): string {
  const anchor = group.questions[0];
  const readable = normalizeFactKey([
    anchor.theme,
    anchor.category,
    anchor.answer,
    anchor.prompt,
  ].filter(Boolean).join(" "));
  return readable || `fact_${anchor.id}`;
}

function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function answerText(q: {
  options: string[];
  correctIndex: number;
  kind: string;
  correctSet: number[];
  correctOrder: number[];
}): string | null {
  if (q.kind === "MULTI" && q.correctSet.length) {
    return q.correctSet.map((i) => q.options[i]).filter(Boolean).join(", ");
  }
  if (q.kind === "ORDER" && q.correctOrder.length) {
    return q.correctOrder.map((i) => q.options[i]).filter(Boolean).join(" > ");
  }
  return q.options[q.correctIndex] ?? null;
}

function reportPromptCore(prompt: string): string {
  return prompt
    .replace(/\s+(WHO AM I\?|TAP THE MAP|MINEFIELD.*|MISSING WORD|GET THE PICTURE|QUICKFIRE.*|VISUAL ID).*$/i, "")
    .replace(/\s+clues:.*$/i, "")
    .replace(/\s+media:.*$/i, "")
    .trim();
}

async function main() {
  const reportPath = process.env.QUESTION_DUPLICATE_REPORT;
  if (!reportPath) throw new Error("QUESTION_DUPLICATE_REPORT is required");

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as DuplicateReport;
  const factKeyById = new Map<string, string>();
  const factKeyBySignature = new Map<string, string>();
  for (const group of report.groups) {
    const factKey = groupFactKey(group);
    for (const question of group.questions) {
      factKeyById.set(question.id, factKey);
      factKeyBySignature.set(
        `${norm(reportPromptCore(question.prompt))}::${norm(question.answer)}`,
        factKey,
      );
    }
  }

  const templates = await prisma.questionTemplate.findMany({
    select: {
      id: true,
      content: true,
      options: true,
      correctIndex: true,
      kind: true,
      correctSet: true,
      correctOrder: true,
      kicker: true,
      clues: true,
      mediaUrl: true,
      soundUrl: true,
      theme: true,
      category: true,
      difficulty: true,
    },
  });

  let grouped = 0;
  let ungrouped = 0;
  for (const template of templates) {
    const signature = `${norm(template.content)}::${norm(answerText(template))}`;
    const factKey = factKeyById.get(template.id) ?? factKeyBySignature.get(signature) ?? seedFactKey(template);
    if (factKeyById.has(template.id) || factKeyBySignature.has(signature)) grouped++;
    else ungrouped++;
    await prisma.questionTemplate.update({
      where: { id: template.id },
      data: { factKey },
    });
  }

  await prisma.$executeRaw`
    DELETE FROM "LevelQuestionExposure" e
    USING (
      SELECT id
      FROM (
        SELECT
          e.id,
          ROW_NUMBER() OVER (
            PARTITION BY e."userId", e.track, q."factKey"
            ORDER BY e."lastSeenAt" DESC, e."seenCount" DESC, e.id
          ) AS rn
        FROM "LevelQuestionExposure" e
        JOIN "QuestionTemplate" q ON q.id = e."templateId"
      ) ranked
      WHERE ranked.rn > 1
    ) duplicates
    WHERE e.id = duplicates.id
  `;

  await prisma.$executeRaw`
    UPDATE "LevelQuestionExposure" e
    SET "factKey" = q."factKey"
    FROM "QuestionTemplate" q
    WHERE e."templateId" = q.id
  `;

  console.log(JSON.stringify({
    templates: templates.length,
    grouped,
    ungrouped,
    groups: report.groups.length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
