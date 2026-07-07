/**
 * Scoring authority — tournament answer records and server-side scoring.
 */

import {
  scoreAnswer,
  scoreRound,
  type RoundAnswer,
  type ScorableKind,
  type ScorableQuestion,
} from "@/lib/player/scoring";

export type { ScorableQuestion, RoundAnswer, ScorableKind };
export { scoreAnswer, scoreRound };

/** Answer record written to GameEntry.answers JSON. */
export type GameAnswerRecord = {
  selected: number | null;
  selection?: number[];
  correct: boolean;
  points: number;
  ms: number;
  kind?: ScorableKind;
};

/** Score a tournament round and build per-question answer records. */
export function scoreTournamentRound(
  issued: ScorableQuestion[],
  answers: RoundAnswer[],
): { roundScore: number; records: Record<string, GameAnswerRecord> } {
  const roundScore = scoreRound(issued, answers);
  const byId = new Map(issued.map((q) => [q.id, q]));
  const records: Record<string, GameAnswerRecord> = {};

  for (const a of answers ?? []) {
    const q = byId.get(a.id);
    if (!q) continue;
    const points = scoreAnswer(q, a);
    records[a.id] = {
      selected: a.selection.length === 1 ? a.selection[0] : null,
      selection: a.selection.length > 0 ? a.selection : undefined,
      correct: points > 0,
      points,
      ms: a.responseMs,
      kind: q.kind,
    };
  }

  return { roundScore, records };
}