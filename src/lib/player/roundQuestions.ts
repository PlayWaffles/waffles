/**
 * Solo level-campaign question sourcing (served from the DB, no local bank) plus
 * the shared template→client mappers reused by the tournament read path.
 *
 * NB: tournament rounds are NOT issued here. Each tournament `Game` has
 * its own `Question` rows, assigned at game-creation time from theme-matched
 * `QuestionTemplate`s (see `getAutoQuestionTemplates` in `lib/game/auto-create`),
 * and read back via `getTournamentClientQuestions` in `lib/player/tournamentGames`.
 */
import { prisma } from "@/lib/db";
import { Difficulty, GameTheme, QuestionKind } from "@prisma";
import { scoreAnswer, type RoundAnswer, type ScorableKind, type ScorableQuestion } from "./scoring";
import { recordQuestionStats } from "./questionStats";

const KIND_MAP: Record<QuestionKind, ScorableKind> = {
  [QuestionKind.SINGLE]: "single",
  [QuestionKind.MULTI]: "multi",
  [QuestionKind.ORDER]: "order",
  [QuestionKind.SPATIAL]: "spatial",
};

/** Deterministic permutation of `[0..n)` seeded by a string (xfnv1a → mulberry32
 *  → Fisher–Yates). Same seed ⇒ same order every call, so a question's options
 *  land in the same slots whether they're being rendered or re-scored. */
function optionPermutation(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

/** Shuffle a question's answer options so the correct one isn't pinned to a
 *  fixed slot, remapping every index-aligned field to match. Deterministic
 *  (seeded by question id) so the client's rendered order and the server's
 *  re-scoring order are always identical. Only pick-one / pick-many kinds are
 *  shuffled — SPATIAL (the position IS the answer) and ORDER (the scramble is
 *  the puzzle) are left untouched. */
export function shuffleQuestionOptions<
  T extends { id: string; kind: QuestionKind; options: string[]; correctIndex: number; correctSet: number[]; correctOrder: number[] },
>(q: T): T {
  // Shuffle SINGLE/MULTI/ORDER so the answer's position isn't predictable (incl.
  // ORDER questions authored already-in-sequence, where "tap as shown" would win).
  // SPATIAL is excluded: its options pair with a parallel `flags[]` (tile coords)
  // we don't remap here, so reordering them would desync the two.
  if (q.kind === QuestionKind.SPATIAL) return q;
  const n = q.options.length;
  if (n < 2) return q;
  const order = optionPermutation(q.id, n); // newPos -> oldIdx
  if (order.every((o, i) => o === i)) return q; // identity — nothing to do
  const pos = new Array<number>(n); // oldIdx -> newPos
  order.forEach((oldIdx, newPos) => { pos[oldIdx] = newPos; });
  return {
    ...q,
    options: order.map((oldIdx) => q.options[oldIdx]),
    correctIndex: q.correctIndex >= 0 && q.correctIndex < n ? pos[q.correctIndex] : q.correctIndex,
    correctSet: q.correctSet.map((i) => pos[i] ?? i),
    correctOrder: q.correctOrder.map((i) => pos[i] ?? i),
  };
}

// Candidate pools are stable within a short window; cache them briefly so
// per-level calls don't re-scan the whole table.
const POOL_TTL_MS = 60_000;

type TemplateRow = {
  id: string;
  content: string;
  options: string[];
  correctIndex: number;
  durationSec: number;
  kind: QuestionKind;
  correctSet: number[];
  pick: number | null;
  correctOrder: number[];
  flags: string[];
  minefield: boolean;
  kicker: string | null;
  clues: string[];
  theme: string;
  category: string | null;
  mediaUrl: string | null;
};

const TEMPLATE_SELECT = {
  id: true,
  content: true,
  options: true,
  correctIndex: true,
  durationSec: true,
  kind: true,
  correctSet: true,
  pick: true,
  correctOrder: true,
  flags: true,
  minefield: true,
  kicker: true,
  clues: true,
  theme: true,
  category: true,
  mediaUrl: true,
} as const;

/** The shape the v2 client consumes for a live question (matches `Question`). */
export type ClientRoundQuestion = {
  id: string;
  cat: string;
  q: string;
  answers: string[];
  correct: number;
  kind: ScorableKind;
  correctSet?: number[];
  pick?: number;
  correctOrder?: number[];
  flags?: string[];
  kicker?: string;
  clues?: string[];
  image?: string;
  time?: number;
  minefield?: boolean;
};

export const themeLabel = (theme: string) =>
  theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase();

/** The subject shown in the question pill. Prefers the authoring category (the
 *  topic, e.g. "History"), but the World-Cup format packs tag their category as
 *  "WC: <format>" (a format, not a topic) — for those we fall back to the game's
 *  theme label so the pill shows the subject and the format stays in the kicker. */
export const displayCategory = (category: string | null | undefined, theme: string): string =>
  category && !category.startsWith("WC: ") ? category : themeLabel(theme);

/** Map a template row to the client question shape (answer keys included). The
 *  options are shuffled (deterministically, per question) so the correct answer
 *  isn't always in the same slot; levels score on the client against this same
 *  `correct`, so display and grading stay in lock-step. */
function rowToClient(row: TemplateRow): ClientRoundQuestion {
  const r = shuffleQuestionOptions(row);
  return {
    id: r.id,
    cat: displayCategory(r.category, r.theme),
    q: r.content,
    answers: r.options,
    correct: r.correctIndex,
    kind: KIND_MAP[r.kind],
    correctSet: r.correctSet.length ? r.correctSet : undefined,
    pick: r.pick ?? undefined,
    correctOrder: r.correctOrder.length ? r.correctOrder : undefined,
    flags: r.flags.length ? r.flags : undefined,
    kicker: r.kicker ?? undefined,
    clues: r.clues.length ? r.clues : undefined,
    image: r.mediaUrl ?? undefined,
    time: r.durationSec,
    minefield: r.minefield || undefined,
  };
}

// ---------------------------------------------------------------------------
// Solo level campaign — questions also served from the DB (no local bank).
// ---------------------------------------------------------------------------

export type LevelTrack = "standard" | "world-cup";

/** Questions per solo level. */
export const QUESTIONS_PER_LEVEL = 4;

const DIFFICULTY_VALUE: Record<Difficulty, number> = {
  [Difficulty.EASY]: 0,
  [Difficulty.MEDIUM]: 1,
  [Difficulty.HARD]: 2,
};

const KIND_ROTATION = [
  QuestionKind.SINGLE,
  QuestionKind.MULTI,
  QuestionKind.ORDER,
  QuestionKind.SPATIAL,
];

type LevelSlot = { difficulty: Difficulty; kind: QuestionKind };

function levelDifficultyPlan(level: number, n: number): Difficulty[] {
  let plan: Difficulty[];
  if (level < 4) plan = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.EASY, Difficulty.MEDIUM];
  else if (level < 8) plan = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.MEDIUM, Difficulty.HARD];
  else if (level < 16) plan = [Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.MEDIUM];
  else if (level < 28) plan = [Difficulty.MEDIUM, Difficulty.HARD, Difficulty.MEDIUM, Difficulty.HARD];
  else if (level < 40) plan = [Difficulty.MEDIUM, Difficulty.HARD, Difficulty.HARD, Difficulty.MEDIUM];
  else plan = [Difficulty.HARD, Difficulty.MEDIUM, Difficulty.HARD, Difficulty.HARD];
  return Array.from({ length: n }, (_, i) => plan[i % plan.length]);
}

function levelSlots(level: number, n: number): LevelSlot[] {
  const difficulties = levelDifficultyPlan(level, n);
  const offset = Math.max(0, level - 1) % KIND_ROTATION.length;
  return difficulties.map((difficulty, i) => ({
    difficulty,
    kind: KIND_ROTATION[(offset + i) % KIND_ROTATION.length],
  }));
}

// Candidate pool per track, cached briefly. "world-cup" draws FOOTBALL-themed
// questions; "standard" draws everything else (evergreen).
type Candidate = {
  id: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  category: string | null;
  usageCount: number;
  durationSec: number;
  stats: {
    playCount: number;
    correctCount: number;
    totalResponseMs: bigint;
    lastPlayedAt: Date | null;
  }[];
};
const levelPoolCache = new Map<LevelTrack, { items: Candidate[]; at: number }>();

async function levelPool(track: LevelTrack): Promise<Candidate[]> {
  const cached = levelPoolCache.get(track);
  if (cached && Date.now() - cached.at < POOL_TTL_MS) return cached.items;
  const where =
    track === "world-cup"
      ? { theme: GameTheme.FOOTBALL }
      : { theme: { not: GameTheme.FOOTBALL } };
  const rows = await prisma.questionTemplate.findMany({
    where,
    select: {
      id: true,
      difficulty: true,
      kind: true,
      category: true,
      usageCount: true,
      durationSec: true,
      stats: {
        where: { mode: "level" },
        select: {
          playCount: true,
          correctCount: true,
          totalResponseMs: true,
          lastPlayedAt: true,
        },
      },
    },
  });
  const items = rows as Candidate[];
  levelPoolCache.set(track, { items, at: Date.now() });
  return items;
}

function targetCorrectRate(difficulty: Difficulty): number {
  if (difficulty === Difficulty.EASY) return 0.78;
  if (difficulty === Difficulty.MEDIUM) return 0.62;
  return 0.46;
}

function candidateScore(
  candidate: Candidate,
  slot: LevelSlot,
  usedKinds: Set<QuestionKind>,
  usedCategories: Set<string>,
  now: number,
): number {
  const stat = candidate.stats[0];
  const difficultyDistance = Math.abs(
    DIFFICULTY_VALUE[candidate.difficulty] - DIFFICULTY_VALUE[slot.difficulty],
  );
  const categoryKey = candidate.category ?? "";
  const playCount = stat?.playCount ?? 0;
  const correctRate = playCount > 0 && stat ? stat.correctCount / playCount : null;
  const avgResponseRatio =
    playCount > 0 && stat && candidate.durationSec > 0
      ? Number(stat.totalResponseMs) / playCount / (candidate.durationSec * 1000)
      : null;
  const daysSincePlayed = stat?.lastPlayedAt
    ? (now - stat.lastPlayedAt.getTime()) / 86_400_000
    : null;

  let score = 0;
  score += difficultyDistance === 0 ? 120 : difficultyDistance === 1 ? 52 : 8;
  score += candidate.kind === slot.kind ? 105 : usedKinds.has(candidate.kind) ? -20 : 32;
  score += categoryKey && !usedCategories.has(categoryKey) ? 38 : categoryKey ? -34 : 0;
  score += Math.max(0, 28 - candidate.usageCount * 0.8);

  if (correctRate == null || playCount < 8) {
    score += 16;
  } else {
    score += Math.max(0, 34 - Math.abs(correctRate - targetCorrectRate(slot.difficulty)) * 100);
    if (slot.difficulty === Difficulty.EASY && correctRate > 0.9) score -= 24;
  }

  if (avgResponseRatio != null) {
    score += Math.max(0, Math.min(16, avgResponseRatio * 18));
  }
  if (daysSincePlayed != null && daysSincePlayed < 7) {
    score -= 14 - daysSincePlayed * 2;
  }

  return score;
}

function pickRanked(candidates: Candidate[], score: (candidate: Candidate) => number): Candidate {
  const ranked = candidates
    .map((candidate) => ({ candidate, score: score(candidate) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(5, candidates.length));
  const floor = Math.min(...ranked.map((item) => item.score));
  const weighted = ranked.map((item) => ({
    ...item,
    weight: Math.max(1, item.score - floor + 1),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.candidate;
  }
  return weighted[0].candidate;
}

/** Select level question ids by difficulty, kind, category, and observed stats. */
async function levelIds(track: LevelTrack, level: number, n: number): Promise<string[]> {
  const pool = await levelPool(track);
  if (pool.length === 0) return [];
  const used = new Set<string>();
  const usedKinds = new Set<QuestionKind>();
  const usedCategories = new Set<string>();
  const out: string[] = [];
  const now = Date.now();

  for (const slot of levelSlots(level, n)) {
    const unused = pool.filter((q) => !used.has(q.id));
    if (unused.length === 0) break;

    const exact = unused.filter((q) => q.difficulty === slot.difficulty && q.kind === slot.kind);
    const kindMatched = unused.filter((q) => q.kind === slot.kind);
    const difficultyMatched = unused.filter((q) => q.difficulty === slot.difficulty);
    const tier = exact.length > 0
      ? exact
      : kindMatched.length > 0
        ? kindMatched
        : difficultyMatched.length > 0
          ? difficultyMatched
          : unused;

    const pick = pickRanked(tier, (candidate) =>
      candidateScore(candidate, slot, usedKinds, usedCategories, now),
    );
    used.add(pick.id);
    usedKinds.add(pick.kind);
    if (pick.category) usedCategories.add(pick.category);
    out.push(pick.id);
  }
  return out;
}

/** The solo level's questions in client shape (answer keys included). */
export async function getLevelClientQuestions(
  track: LevelTrack,
  level: number,
  n = QUESTIONS_PER_LEVEL,
): Promise<ClientRoundQuestion[]> {
  const ids = await levelIds(track, level, n);
  if (ids.length === 0) return [];
  const rows = await prisma.questionTemplate.findMany({
    where: { id: { in: ids } },
    select: TEMPLATE_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, r as TemplateRow]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is TemplateRow => Boolean(r))
    .map(rowToClient);
}

/**
 * Record per-question play stats for a solo LEVEL answer set (mode "level").
 * Levels are scored client-side, so the client sends its selections and the
 * server RE-SCORES against the template's answer keys (anti-skew) before
 * incrementing QuestionStat. For levels the question id IS the template id
 * (getLevelClientQuestions returns id = template.id). Best-effort.
 */
export async function recordLevelQuestionStats(answers: RoundAnswer[]): Promise<void> {
  const ids = answers.map((a) => a.id).filter(Boolean);
  if (ids.length === 0) return;
  const tpls = await prisma.questionTemplate.findMany({
    where: { id: { in: ids } },
    select: { id: true, kind: true, correctIndex: true, correctSet: true, pick: true, correctOrder: true, minefield: true, durationSec: true },
  });
  const byId = new Map(tpls.map((t) => [t.id, t]));
  const items = answers.flatMap((a) => {
    const t = byId.get(a.id);
    if (!t) return [];
    const q: ScorableQuestion = {
      id: t.id,
      kind: KIND_MAP[t.kind],
      correct: t.correctIndex,
      correctSet: t.correctSet,
      pick: t.pick,
      correctOrder: t.correctOrder,
      minefield: t.minefield,
      durationSec: t.durationSec,
    };
    return [{ templateId: t.id, correct: scoreAnswer(q, a) > 0, responseMs: a.responseMs }];
  });
  await recordQuestionStats("level", items);
}
