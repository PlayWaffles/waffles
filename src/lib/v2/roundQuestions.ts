/**
 * Server-authoritative tournament question set.
 *
 * Each hourly round draws the SAME deterministic slice of `QuestionTemplate`s
 * for every entrant, seeded by `roundId`. The client renders this set (it still
 * gets the answer keys, for instant feedback), but the server keeps the same set
 * to (a) re-score the submitted answers and (b) reject answers for questions
 * that weren't in the round. Determinism means entry-time issuance and
 * settlement-time scoring resolve to the identical set without persisting it.
 */
import { prisma } from "@/lib/db";
import { Difficulty, GameTheme, QuestionKind } from "@prisma";
import type { ScorableKind, ScorableQuestion } from "./scoring";

/** Questions per tournament round — server-authoritative (was client `tweaks`). */
export const QUESTIONS_PER_ROUND = 6;

/** Deterministic 32-bit PRNG (mulberry32). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher–Yates — stable for a given (array, seed). */
function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const KIND_MAP: Record<QuestionKind, ScorableKind> = {
  [QuestionKind.SINGLE]: "single",
  [QuestionKind.MULTI]: "multi",
  [QuestionKind.ORDER]: "order",
  [QuestionKind.SPATIAL]: "spatial",
};

// The candidate pool (template ids) is stable within a round window; cache it
// briefly so per-entry/settlement calls don't re-scan the whole table.
let poolCache: { ids: string[]; at: number } | null = null;
const POOL_TTL_MS = 60_000;

async function poolIds(): Promise<string[]> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache.ids;
  const rows = await prisma.questionTemplate.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  poolCache = { ids: rows.map((r) => r.id), at: Date.now() };
  return poolCache.ids;
}

/** The ids issued for a round, in play order (deterministic by roundId). */
async function issuedIds(roundId: number, n: number): Promise<string[]> {
  const ids = await poolIds();
  if (ids.length === 0) return [];
  // roundId is an ms epoch aligned to the hour; reduce to a 32-bit seed.
  const seed = Math.floor(roundId / 1000) >>> 0;
  return seededShuffle(ids, seed).slice(0, Math.min(n, ids.length));
}

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
} as const;

/** Load the round's issued templates, preserving play order. */
async function issuedRows(roundId: number, n: number): Promise<TemplateRow[]> {
  const ids = await issuedIds(roundId, n);
  if (ids.length === 0) return [];
  const rows = await prisma.questionTemplate.findMany({
    where: { id: { in: ids } },
    select: TEMPLATE_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, r as TemplateRow]));
  return ids.map((id) => byId.get(id)).filter((r): r is TemplateRow => Boolean(r));
}

/** The round's questions WITH answer keys — for server-side scoring. */
export async function getRoundScorableSet(
  roundId: number,
  n = QUESTIONS_PER_ROUND,
): Promise<ScorableQuestion[]> {
  const rows = await issuedRows(roundId, n);
  return rows.map((r) => ({
    id: r.id,
    kind: KIND_MAP[r.kind],
    correct: r.correctIndex,
    correctSet: r.correctSet,
    pick: r.pick,
    correctOrder: r.correctOrder,
    minefield: r.minefield,
    durationSec: r.durationSec,
  }));
}

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
  time?: number;
  minefield?: boolean;
};

const themeLabel = (theme: string) =>
  theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase();

/** Map a template row to the client question shape (answer keys included). */
function rowToClient(r: TemplateRow): ClientRoundQuestion {
  return {
    id: r.id,
    cat: r.category ?? themeLabel(r.theme),
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
    time: r.durationSec,
    minefield: r.minefield || undefined,
  };
}

/** The round's questions in client shape (keys included for instant feedback). */
export async function getRoundClientQuestions(
  roundId: number,
  n = QUESTIONS_PER_ROUND,
): Promise<ClientRoundQuestion[]> {
  const rows = await issuedRows(roundId, n);
  return rows.map(rowToClient);
}

// ---------------------------------------------------------------------------
// Solo level campaign — questions also served from the DB (no local bank).
// ---------------------------------------------------------------------------

export type LevelTrack = "standard" | "world-cup";

/** Questions per solo level. */
export const QUESTIONS_PER_LEVEL = 5;

/**
 * Difficulty ramp for a level — mirrors the client `levelDifficulties`: early
 * levels stay easy, later levels mix in medium then hard.
 */
function levelDifficultyRamp(level: number, n: number): Difficulty[] {
  let pool: Difficulty[];
  if (level < 8) pool = [Difficulty.EASY];
  else if (level < 16) pool = [Difficulty.EASY, Difficulty.MEDIUM];
  else if (level < 28) pool = [Difficulty.MEDIUM];
  else if (level < 40) pool = [Difficulty.MEDIUM, Difficulty.HARD];
  else pool = [Difficulty.HARD];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

// Candidate (id, difficulty) pool per track, cached briefly. "world-cup" draws
// FOOTBALL-themed questions; "standard" draws everything else (evergreen).
type Candidate = { id: string; difficulty: Difficulty };
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
    select: { id: true, difficulty: true },
  });
  const items = rows as Candidate[];
  levelPoolCache.set(track, { items, at: Date.now() });
  return items;
}

/** Select level question ids by the difficulty ramp, no repeats. */
async function levelIds(track: LevelTrack, level: number, n: number): Promise<string[]> {
  const pool = await levelPool(track);
  if (pool.length === 0) return [];
  const used = new Set<string>();
  const out: string[] = [];
  for (const d of levelDifficultyRamp(level, n)) {
    let tier = pool.filter((q) => q.difficulty === d && !used.has(q.id));
    if (tier.length === 0) tier = pool.filter((q) => !used.has(q.id));
    if (tier.length === 0) break;
    const pick = tier[Math.floor(Math.random() * tier.length)];
    used.add(pick.id);
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
