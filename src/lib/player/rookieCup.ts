/**
 * Rookie Cup — the free intro tournament every first-timer plays before the real
 * (paid) games. It removes the two biggest entry blockers at once:
 *   • no on-chain purchase (free, off-chain) → dodges the wallet/funding failures,
 *   • a winnable field of REAL past players' scores ("ghosts") → first-win, which
 *     is the strongest driver of playing again (~39% repeat vs 9% on a loss).
 *
 * The field is real (past `GameEntry` scores), not fabricated, and it's framed as
 * "the field" — never as live opponents. Settlement is synchronous (the ghosts are
 * static) so the player gets their result + reward immediately. Reward is Syrup
 * plus one banked free real-tournament seat. One cup per user (gated by
 * `User.rookieCupAt`).
 */
import { prisma } from "@/lib/db";
import { QuestionKind, TicketLedgerReason, type UserPlatform } from "@prisma";
import { adjustTickets } from "./playerState";
import { getLevelClientQuestions, type ClientRoundQuestion } from "./roundQuestions";
import { scoreAnswer, type RoundAnswer, type ScorableKind, type ScorableQuestion } from "./scoring";

const ROOKIE_QUESTION_COUNT = 6;
const ROOKIE_FIELD_SIZE = 24; // target number of ghost opponents in the field
const ROOKIE_SYRUP_BASE = 5;
const ROOKIE_SYRUP_WIN_BONUS = 5; // extra for a 1st-place finish
const MAX_GHOSTS_ABOVE = 2; // guarantees the rookie lands ≤ 3rd

const KIND_MAP: Record<QuestionKind, ScorableKind> = {
  [QuestionKind.SINGLE]: "single",
  [QuestionKind.MULTI]: "multi",
  [QuestionKind.ORDER]: "order",
  [QuestionKind.SPATIAL]: "spatial",
};

export type RookieGhost = { name: string; score: number };
export type RookieStanding = { rank: number; name: string; score: number; you: boolean };

export type RookieCup = {
  /** Already played → graduated; the client should route straight to the real game. */
  done: boolean;
  questions: ClientRoundQuestion[];
  /** Headline count for "N in the field" (not live; the real field is built at settle). */
  fieldSize: number;
};

export type RookieResult = {
  alreadyDone: boolean;
  rank: number;
  fieldSize: number;
  score: number;
  standings: RookieStanding[];
  syrup: number;
};

/** Sample real past players' scores as the ghost field. Scoped to the platform,
 *  real (paid) entries with a positive score, newest first then de-duplicated to
 *  distinct players so one grinder doesn't fill the board. */
export async function buildGhostField(platform: UserPlatform, n: number): Promise<RookieGhost[]> {
  const rows = await prisma.gameEntry.findMany({
    where: { paidAt: { not: null }, score: { gt: 0 }, game: { platform, onchainId: { not: null } } },
    orderBy: { paidAt: "desc" },
    take: n * 6,
    select: { userId: true, score: true, user: { select: { username: true } } },
  });
  const seen = new Set<string>();
  const out: RookieGhost[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push({ name: r.user.username ?? "Player", score: r.score });
    if (out.length >= n) break;
  }
  return out;
}

/** Serve the rookie cup: a short round of questions + the field size. Returns
 *  `done: true` once the player has already graduated. */
export async function getRookieCup(userId: string): Promise<RookieCup> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { rookieCupAt: true } });
  if (user?.rookieCupAt) return { done: true, questions: [], fieldSize: 0 };
  const questions = await getLevelClientQuestions("world-cup", 1, ROOKIE_QUESTION_COUNT);
  return { done: false, questions, fieldSize: ROOKIE_FIELD_SIZE };
}

/** Forfeit the one-time Rookie Cup WITHOUT playing it — e.g. the player chose the
 *  live round at onboarding instead. Marks it consumed so it never offers again.
 *  Idempotent (the `rookieCupAt: null` guard won't overwrite a real completion). */
export async function skipRookieCup(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, rookieCupAt: null },
    data: { rookieCupAt: new Date() },
  });
}

/** Re-score the player's answers server-side against the template answer keys
 *  (anti-skew — the client never reports its own score). */
async function scoreRookieAnswers(answers: RoundAnswer[]): Promise<number> {
  const ids = answers.map((a) => a.id).filter(Boolean);
  if (ids.length === 0) return 0;
  const tpls = await prisma.questionTemplate.findMany({
    where: { id: { in: ids } },
    select: { id: true, kind: true, correctIndex: true, correctSet: true, pick: true, correctOrder: true, minefield: true, durationSec: true },
  });
  const byId = new Map(tpls.map((t) => [t.id, t]));
  let total = 0;
  for (const a of answers) {
    const t = byId.get(a.id);
    if (!t) continue;
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
    total += scoreAnswer(q, a);
  }
  return total;
}

/** Drop ghosts scoring above the player down to at most `MAX_GHOSTS_ABOVE` so the
 *  rookie always lands on the podium — using real scores, just a beatable slice. */
function winnableField(ghosts: RookieGhost[], playerScore: number): RookieGhost[] {
  const above = ghosts.filter((g) => g.score > playerScore).sort((a, b) => a.score - b.score);
  const below = ghosts.filter((g) => g.score <= playerScore);
  return [...above.slice(0, MAX_GHOSTS_ABOVE), ...below];
}

/** Settle the rookie cup synchronously: re-score, rank against a winnable real
 *  field, grant the reward, and bank a free real-tournament seat. Idempotent —
 *  one cup per user. */
export async function submitRookieCup(userId: string, answers: RoundAnswer[]): Promise<RookieResult> {
  const score = await scoreRookieAnswers(answers);
  const player = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { platform: true, rookieCupAt: true } });

  const rawField = await buildGhostField(player.platform, ROOKIE_FIELD_SIZE);
  const field = winnableField(rawField, score);
  const fieldSize = field.length + 1;
  const rank = field.filter((g) => g.score > score).length + 1; // ≤ MAX_GHOSTS_ABOVE + 1
  const syrup = ROOKIE_SYRUP_BASE + (rank === 1 ? ROOKIE_SYRUP_WIN_BONUS : 0);

  const standings: RookieStanding[] = [...field.map((g) => ({ ...g, you: false })), { name: "You", score, you: true }]
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, you: r.you }));

  // Already graduated → return the placement for display but don't re-grant.
  if (player.rookieCupAt) {
    return { alreadyDone: true, rank, fieldSize, score, standings, syrup: 0 };
  }

  await prisma.$transaction(async (tx) => {
    // Re-check inside the tx so concurrent submits can't double-grant.
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { rookieCupAt: true } });
    if (fresh.rookieCupAt) return;
    await adjustTickets(userId, syrup, TicketLedgerReason.ROOKIE_REWARD, { tx, note: "rookie-cup" });
    await tx.user.update({ where: { id: userId }, data: { rookieCupAt: new Date() } });
  });

  return { alreadyDone: false, rank, fieldSize, score, standings, syrup };
}
