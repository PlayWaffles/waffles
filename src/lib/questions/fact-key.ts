import OpenAI from "openai";
import { GameTheme, QuestionKind, type Difficulty } from "@prisma";

export type QuestionFactInput = {
  id?: string;
  content: string;
  options: string[];
  correctIndex: number;
  kind?: QuestionKind;
  correctSet?: number[];
  correctOrder?: number[];
  kicker?: string | null;
  clues?: string[];
  mediaUrl?: string | null;
  soundUrl?: string | null;
  theme?: GameTheme;
  category?: string | null;
  difficulty?: Difficulty;
};

export type ExistingQuestionFact = QuestionFactInput & {
  id: string;
  factKey: string;
};

export type QuestionFactClassification = {
  duplicate: boolean;
  factKey: string;
  duplicateTemplateId: string | null;
  confidence: number;
  reason: string;
};

export class DuplicateQuestionFactError extends Error {
  constructor(
    readonly duplicateTemplateId: string,
    readonly factKey: string,
    readonly confidence: number,
    readonly reason: string,
  ) {
    super(`Question duplicates ${duplicateTemplateId}: ${reason}`);
    this.name = "DuplicateQuestionFactError";
  }
}

const FACT_KEY_MODEL = process.env.QUESTION_FACT_MODEL || "gpt-5.4-mini";

function answerText(q: QuestionFactInput): string | null {
  if (q.kind === QuestionKind.MULTI && q.correctSet?.length) {
    return q.correctSet.map((i) => q.options[i]).filter(Boolean).join(", ");
  }
  if (q.kind === QuestionKind.ORDER && q.correctOrder?.length) {
    return q.correctOrder.map((i) => q.options[i]).filter(Boolean).join(" > ");
  }
  return q.options[q.correctIndex] ?? null;
}

function compactQuestion(q: QuestionFactInput) {
  return {
    id: q.id,
    prompt: q.content,
    answer: answerText(q),
    kind: q.kind ?? QuestionKind.SINGLE,
    kicker: q.kicker ?? null,
    clues: q.clues ?? [],
    mediaUrl: q.mediaUrl ?? null,
    soundUrl: q.soundUrl ?? null,
    theme: q.theme,
    category: q.category ?? null,
    difficulty: q.difficulty,
    options: q.options,
  };
}

export function normalizeFactKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 160);
}

export function seedFactKey(q: QuestionFactInput): string {
  const answer = answerText(q);
  return normalizeFactKey([
    q.theme ?? GameTheme.GENERAL,
    q.category,
    q.kind ?? QuestionKind.SINGLE,
    q.kicker,
    q.content,
    answer,
    q.mediaUrl,
    q.soundUrl,
  ].filter(Boolean).join(" "));
}

const SYSTEM_PROMPT = `You are a strict trivia question-bank editor.

Assign one durable factKey to the NEW question.

Rules:
- factKey names the exact underlying knowledge tested, not the surface wording.
- Use snake_case, lowercase ASCII, max 160 chars.
- If the new question tests the same underlying fact as an existing candidate, return duplicate=true with that candidate's id and factKey.
- Same answer is not enough. Different player, image, host/winner/year/opponent/scorer/count/nickname relationships are different facts.
- Format variants are duplicates when they test the same fact: direct, clue, missing-word, map, picture, quickfire, minefield, or audio.
- Different media identification items are different facts unless they show the same entity and ask the same identification.

Return strict JSON only.`;

function schema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["duplicate", "factKey", "duplicateTemplateId", "confidence", "reason"],
    properties: {
      duplicate: { type: "boolean" },
      factKey: { type: "string" },
      duplicateTemplateId: { type: ["string", "null"] },
      confidence: { type: "number" },
      reason: { type: "string" },
    },
  };
}

function openAiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to classify question fact keys");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function classifyQuestionFact(
  question: QuestionFactInput,
  candidates: ExistingQuestionFact[],
): Promise<QuestionFactClassification> {
  const response = await openAiClient().responses.create({
    model: FACT_KEY_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          newQuestion: compactQuestion(question),
          existingCandidates: candidates.map((candidate) => ({
            ...compactQuestion(candidate),
            factKey: candidate.factKey,
          })),
        }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "question_fact_classification",
        strict: true,
        schema: schema(),
      },
    },
  });
  const parsed = JSON.parse(response.output_text) as QuestionFactClassification;
  const factKey = normalizeFactKey(parsed.factKey);
  if (!factKey) throw new Error("OpenAI returned an empty question factKey");
  return { ...parsed, factKey };
}

export async function assertUniqueQuestionFact(
  question: QuestionFactInput,
  candidates: ExistingQuestionFact[],
): Promise<string> {
  const result = await classifyQuestionFact(question, candidates);
  if (result.duplicate && result.duplicateTemplateId) {
    throw new DuplicateQuestionFactError(
      result.duplicateTemplateId,
      result.factKey,
      result.confidence,
      result.reason,
    );
  }
  return result.factKey;
}
