/**
 * Server-authoritative round scoring.
 *
 * Mirrors the client scoring in `src/app/v2/_app/state.tsx` EXACTLY, so an
 * honestly-played round recomputes to the same number — but the score written
 * to the DB is derived from the SERVER's own answer key and clamped timing, not
 * the client's self-reported integer. This is what makes tournament prizes
 * (real USDT) safe to settle on: a tampered client can no longer post an
 * arbitrary score.
 *
 * Client formula being mirrored:
 *   base = round(100 + remainingSec * 20)
 *   single/spatial: correct ? base : 0   (minefield: correct ? round(base*1.5) : -150)
 *   multi:  accuracy = clamp01((correctPicked - wrongPicked) / pick); base * accuracy
 *   order:  accuracy = clamp01(matches / correctOrder.length);        base * accuracy
 * Totals are floored at 0 and capped at the round's theoretical maximum.
 */

export type ScorableKind = "single" | "multi" | "order" | "spatial";

/** A question with its authoritative answer key (server-side only). */
export type ScorableQuestion = {
  id: string;
  kind: ScorableKind;
  correct: number; // single / spatial
  correctSet: number[]; // multi
  pick: number | null; // multi: required number of picks
  correctOrder: number[]; // order
  minefield: boolean;
  durationSec: number; // per-question timer ceiling
};

/**
 * One submitted answer. `selection` is normalized to an index array:
 *   single / spatial: `[chosenIndex]` (empty = no answer / timeout)
 *   multi:            the chosen indices
 *   order:            the chosen sequence
 */
export type RoundAnswer = {
  id: string;
  selection: number[];
  responseMs: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Speed-weighted base for a question given remaining seconds. */
function baseFor(remainingSec: number): number {
  return Math.round(100 + remainingSec * 20);
}

/** Reconstruct remaining seconds from a response time, clamped to the window. */
function remainingSecFrom(responseMs: number, durationSec: number): number {
  const durMs = Math.max(0, durationSec) * 1000;
  const ms = clamp(Number.isFinite(responseMs) ? responseMs : durMs, 0, durMs);
  return clamp(durationSec - ms / 1000, 0, durationSec);
}

/** Theoretical max for one question (answered correctly, instantly). */
export function maxScoreForQuestion(q: ScorableQuestion): number {
  const base = baseFor(q.durationSec);
  if (q.kind === "single" || q.kind === "spatial") {
    return q.minefield ? Math.round(base * 1.5) : base;
  }
  return base;
}

/** Score a single answer against its authoritative key. */
export function scoreAnswer(q: ScorableQuestion, a: RoundAnswer): number {
  const base = baseFor(remainingSecFrom(a.responseMs, q.durationSec));
  const sel = a.selection ?? [];

  if (q.kind === "multi") {
    const cs = q.correctSet ?? [];
    const pick = (q.pick ?? cs.length) || 1;
    const correctPicked = sel.filter((i) => cs.includes(i)).length;
    const wrongPicked = sel.filter((i) => !cs.includes(i)).length;
    const accuracy = clamp01((correctPicked - wrongPicked) / pick);
    return Math.round(base * accuracy);
  }

  if (q.kind === "order") {
    const co = q.correctOrder ?? [];
    const n = co.length || 1;
    const matches = sel.filter((v, p) => v === co[p]).length;
    return Math.round(base * clamp01(matches / n));
  }

  // single / spatial
  const correct = sel.length === 1 && sel[0] === q.correct;
  if (q.minefield) return correct ? Math.round(base * 1.5) : -150;
  return correct ? base : 0;
}

/**
 * Recompute a round's score from submitted answers.
 *
 * - Answers are matched to the round's ISSUED questions by id; any answer whose
 *   id wasn't in the issued set scores nothing (can't smuggle in easy questions).
 * - Each question is counted at most once (no replay/duplication).
 * - The total is floored at 0 and capped at the sum of per-question maxima, so
 *   no combination of timing/selection can exceed an honest perfect run.
 */
export function scoreRound(issued: ScorableQuestion[], answers: RoundAnswer[]): number {
  const byId = new Map(issued.map((q) => [q.id, q]));
  const cap = issued.reduce((sum, q) => sum + maxScoreForQuestion(q), 0);
  const seen = new Set<string>();

  let total = 0;
  for (const a of answers ?? []) {
    const q = byId.get(a.id);
    if (!q || seen.has(a.id)) continue;
    seen.add(a.id);
    total += scoreAnswer(q, a);
  }
  return clamp(total, 0, cap);
}

// ---------------------------------------------------------------------------
// Skill-edge — campaign depth → a tournament head start
// ---------------------------------------------------------------------------

/** Points of starting cushion per completed World Cup campaign level. */
export const SKILL_BONUS_PER_LEVEL = 15;
/** Hard cap on the cushion — kept under a single fast question's value so the
 *  edge tips close finishes into wins without steamrolling an honest round. */
export const SKILL_BONUS_CAP = 200;

/** Tournament "skill-edge": a starting score cushion scaled by how far the
 *  player has climbed the World Cup campaign. Doing BOTH campaign + tournament
 *  is the strongest retention signal in the data, so this makes campaign depth
 *  pay off inside the tournament — and helps manufacture the near-wins that
 *  drive repeat play. `completedLevels` is levels FINISHED (LevelProgress.level
 *  is the next level, so pass `level - 1`); 0 → no edge. */
export function tournamentSkillBonus(completedLevels: number): number {
  if (!completedLevels || completedLevels < 1) return 0;
  return Math.min(Math.floor(completedLevels) * SKILL_BONUS_PER_LEVEL, SKILL_BONUS_CAP);
}
