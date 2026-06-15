"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { QUESTION_BANK, type BankQuestion, type Difficulty } from "./data/questions";
import { FORMATS, type VMedia, type VQuestion, type FormatDef } from "./world-cup/data";
import { THEMES, resolveThemeId } from "./theme";
import {
  loadV2State,
  v2AdvanceLevel,
  v2DismissAnnouncement,
  v2EnterRound,
  v2LoseLife,
  v2ConsumePowerUp,
  v2RecordMissionProgress,
  v2RefillLives,
  v2ResolveWinning,
  v2SetAnnouncementsRead,
  v2SetUsername,
  v2SubmitRoundScore,
} from "@/actions/v2";

export type ScreenName =
  | "home"
  | "levels"
  | "levelIntro"
  | "levelWin"
  | "levelFail"
  | "pass"
  | "shop"
  | "leaderboard"
  | "leagues"
  | "missions"
  | "lobby"
  | "question"
  | "results"
  | "profile";

const SCREEN_ORDER: ScreenName[] = [
  "home",
  "levels",
  "levelIntro",
  "pass",
  "missions",
  "leaderboard",
  "leagues",
  "shop",
  "lobby",
  "question",
  "results",
  "levelWin",
  "levelFail",
  "profile",
];

export type GameMode = "tournament" | "level";

// Shop power-ups consumed in the live quiz.
export type PowerUpName = "FIFTY_FIFTY" | "EXTRA_TIME" | "SKIP" | "SHIELD";

// Entry to a live tournament costs a ticket. Tickets are otherwise *earned*
// for free along the level path (curved milestone rewards — see below) and by
// placing well in tournaments — see `tournamentRank` / the finish reward
// below. Levels never cost a ticket; only the competitive ladder does.
export const TOURNAMENT_TICKET_COST = 1;

// Simulated size of the live field. Drives the displayed finishing rank and the
// "of N players" copy across the lobby, results, and Home card.
export const TOURNAMENT_FIELD_SIZE = 2418;

// Prize ladder: finishing rank → tickets won. Risking 1 ticket to enter for a
// shot at 25 is the stakes hook we sell on the Home card. Ordered best tier
// first; `tournamentReward` returns the first tier the rank clears.
export type PrizeTier = { maxRank: number; tickets: number; label: string };
export const TOURNAMENT_PRIZES: PrizeTier[] = [
  { maxRank: 1, tickets: 25, label: "1st" },
  { maxRank: 10, tickets: 10, label: "Top 10" },
  { maxRank: 100, tickets: 3, label: "Top 100" },
];
// Headline "win up to" figure, and the cutoff below which a finish wins nothing.
export const TOURNAMENT_TOP_PRIZE = TOURNAMENT_PRIZES[0].tickets;
export const TOURNAMENT_TICKET_RANK = TOURNAMENT_PRIZES[TOURNAMENT_PRIZES.length - 1].maxRank;

// Tickets won for a given finishing rank. Single source of truth shared by the
// finish reward (balance) and the results screen (display) so they never drift.
export function tournamentReward(rank: number): number {
  for (const tier of TOURNAMENT_PRIZES) if (rank <= tier.maxRank) return tier.tickets;
  return 0;
}

// Prizes are shown in tickets but backed by USDT. This is the peg used to value
// a winning when the player claims it as real money (vs. converting it back into
// spendable in-app tickets): 1 ticket = 0.1 USDT.
export const USDT_PER_TICKET = 0.1;
export function ticketsToUsdt(tickets: number): number {
  return tickets * USDT_PER_TICKET;
}
// Display label for a ticket amount's cash value, e.g. "2.50 USDT". Single
// formatter so the unit is spelled out consistently wherever we show value.
export function usdtLabel(tickets: number): string {
  return `${ticketsToUsdt(tickets).toFixed(2)} USDT`;
}

// First-timer ticket offer: a player's very first ticket is half price
// (0.10 → 0.05 USDT). One-time, tracked in localStorage. Used by the
// post-first-level tournament upsell to lower the barrier to the first entry.
export const FIRST_TICKET_DISCOUNT = 0.5;
const FIRST_TICKET_OFFER_KEY = "waffles.v2.firstTicketUsed";
export function isFirstTicketOfferAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FIRST_TICKET_OFFER_KEY) !== "1";
  } catch {
    return false;
  }
}
export function markFirstTicketOfferUsed(): void {
  try {
    localStorage.setItem(FIRST_TICKET_OFFER_KEY, "1");
  } catch {
    /* storage disabled — offer just won't persist as used */
  }
}

// Free-ticket milestones along the solo level path follow a widening curve:
// frequent early on (activation), rarer the higher you climb (anti-inflation /
// anti-farming). The interval grows by band. This is the only free ticket the
// level path grants — and it's actually paid out on level-up (see the level-win
// branch), unlike the old display-only "every 5 levels" promise.
function ticketMilestoneInterval(level: number): number {
  if (level <= 20) return 5;
  if (level <= 50) return 10;
  if (level <= 100) return 20;
  return 25;
}
export function isLevelTicketMilestone(level: number): boolean {
  return level > 0 && level % ticketMilestoneInterval(level) === 0;
}
// Progress toward the next milestone — drives the level-win card. `prev`/`next`
// are the surrounding milestone levels so the bar fills smoothly across bands.
export function levelTicketMilestoneInfo(level: number): { earned: boolean; nextLevel: number; toGo: number; pct: number } {
  const earned = isLevelTicketMilestone(level);
  let next = level + 1;
  while (!isLevelTicketMilestone(next) && next < level + 200) next++;
  let prev = level;
  while (prev > 0 && !isLevelTicketMilestone(prev)) prev--;
  const span = next - prev || 1;
  const toGo = next - level;
  const pct = Math.max(0, Math.min(100, Math.round(((level - prev) / span) * 100)));
  return { earned, nextLevel: next, toGo, pct };
}

// ─── Lives ──────────────────────────────────────────────────────────────────
// Lives are the stake on the solo level path: a *failed* level (hearts hit 0)
// costs one life. They regenerate on a fast timer (prototype) or refill instantly
// for tickets. At 0 lives the level path is gated until one returns.
export const LIVES_MAX = 5;
export const LIFE_REGEN_MS = 5 * 60 * 1000; // one life every 5 minutes (tunable)
export const LIVES_REFILL_COST = 1;          // tickets to refill to full

// Credit any lives regenerated since `nextLifeAt`. Pure; callers fold the result
// into state. `nextLifeAt` is the epoch-ms the next life lands, null when full.
export function regenLives(lives: number, nextLifeAt: number | null, now: number): { lives: number; nextLifeAt: number | null } {
  if (lives >= LIVES_MAX || nextLifeAt == null) return { lives, nextLifeAt };
  let l = lives;
  let next = nextLifeAt;
  while (l < LIVES_MAX && now >= next) {
    l += 1;
    next += LIFE_REGEN_MS;
  }
  return { lives: l, nextLifeAt: l >= LIVES_MAX ? null : next };
}

// A tournament prize the player has won but not yet resolved. They can either
// `claim` it (withdraw the USDT value) or `convert` it into spendable tickets —
// see the Prize Wallet on the profile screen.
export type Winning = {
  id: string;
  rank: number;
  tickets: number;
  wonAt: number;
  status: "pending" | "claimed" | "converted";
};

// Derive a finishing rank out of the simulated field from the player's score.
export function tournamentRank(score: number, totalQuestions: number): number {
  return Math.max(1, Math.round(TOURNAMENT_FIELD_SIZE * (1 - Math.min(1, score / (totalQuestions * 250)))) + 1);
}

// ─── Hourly rounds ──────────────────────────────────────────────────────────
// A round is the window [roundId, roundId + ROUND_MS). Players join anytime
// inside it; standings stay PROVISIONAL until the round closes, then scores lock
// and prizes settle. Must match the server window in src/lib/v2/rounds.ts so
// client-bucketed roundIds settle on schedule (was 2min in the prototype demo).
export const TOURNAMENT_ROUND_MS = 60 * 60 * 1000;
export const roundIdFor = (now: number): number => Math.floor(now / TOURNAMENT_ROUND_MS) * TOURNAMENT_ROUND_MS;
export const roundCloseAt = (roundId: number): number => roundId + TOURNAMENT_ROUND_MS;

// The player's entry in a round. `score` is null until they finish their
// questions; `settled` flips at close, locking in `finalRank` / `reward`.
export type TournamentEntry = {
  roundId: number;
  score: number | null;
  bonus: boolean;
  settled: boolean;
  finalRank: number | null;
  reward: number | null;
};

// In-app result notification emitted for EVERY entrant at settlement (not only
// winners). Drives the Home result banner + result modal.
export type ResultNotif = {
  id: string;
  roundId: number;
  rank: number;
  reward: number;
  read: boolean;
};

export type Question = {
  cat: string;
  q: string;
  answers: string[];
  correct: number;
  // Format. Absent/"single" = classic one-of-four (the default app). "multi" =
  // pick exactly `pick` correct options from `answers` (correctSet holds them).
  // "order" = arrange all `answers` into the sequence in `correctOrder` (a list
  // of answer indices in the right order). "spatial" = "tap the target" from a
  // board of tiles; scored as single-select (one `correct` index), with an
  // optional emoji/flag per tile in `flags`.
  kind?: "single" | "multi" | "order" | "spatial";
  correctSet?: number[];
  pick?: number;
  correctOrder?: number[];
  flags?: string[];
  // Presentation extras carried by the Format Lab core formats (1–12) when they
  // play live: an overline label, progressive "Who Am I?" clues, a visual/audio
  // clue rendered above the question, a per-question timer (seconds), and the
  // high-risk Minefield flag (wrong answer = 0 points and a score penalty).
  kicker?: string;
  clues?: string[];
  media?: VMedia;
  time?: number;
  minefield?: boolean;
};

// Format Lab core formats (1–12) graduated into live play. Each VQuestion
// becomes one single-select segment carrying its presentation extras; "set"
// formats (mini/big trivia) expand to one segment per question. They join the
// world-cup pack's special pool via FORMAT_REGISTRY below, so a couple surface
// per live round. Content stays sourced from world-cup/data.ts (no duplication).
const vqToSegment = (vq: VQuestion, fmt: FormatDef): Question => ({
  cat: vq.category ?? "Sports",
  q: vq.content,
  answers: vq.options,
  correct: vq.correctIndex,
  kind: "single",
  kicker: vq.kicker,
  clues: vq.clues,
  media: vq.media,
  time: vq.durationSec,
  minefield: fmt.minefield || undefined,
});

// Adapt a bank question to the lighter shape the screens consume.
const toRuntime = (q: BankQuestion): Question => ({
  cat: q.category,
  q: q.question,
  answers: q.answers,
  correct: q.correctIndex,
});

// The full bank in runtime shape (kept for any consumer that wants every
// question). The live quiz, however, draws fresh per-game slices below.
export const QUESTIONS: Question[] = QUESTION_BANK.map(toRuntime);

// Fisher–Yates draw of up to `n` unique items from a pool.
function sample<T>(pool: readonly T[], n: number): T[] {
  const copy = pool.slice();
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// A solo campaign track. Each track has its own independent progression (see
// State.levelByTrack) and its own question pack — "standard" draws evergreen
// (untagged) questions, "world-cup" draws football. The track is chosen by the
// tab on the levels page and is independent of the global theme override, so
// switching tracks reskins only the levels page.
export type LevelTrack = "standard" | "world-cup";
const TRACK_PACK: Record<LevelTrack, string> = { standard: "", "world-cup": "world-cup" };

// Questions available for a pack: a themed pack scopes play to its tag (e.g.
// World Cup football), while the empty pack draws only evergreen (untagged)
// questions. With no argument, uses the active *theme* pack (for tournaments);
// callers can pass an explicit pack (e.g. a level track's). Falls back to the
// whole bank if a pack is ever empty.
function packPool(pack?: string): BankQuestion[] {
  const resolved = pack !== undefined ? pack : THEMES[resolveThemeId()].questionPack;
  const pool = QUESTION_BANK.filter((q) => (resolved ? q.pack === resolved : !q.pack));
  return pool.length ? pool : QUESTION_BANK;
}

// ─── Format graduation pipeline ─────────────────────────────────────────────
// A non-single format goes live by adding ONE entry here. `approved: true` is
// the gate that graduates it from the Format Lab into the live mixed playlist;
// flip it false to pull a format without deleting it. The live playlist samples
// the approved segments for the active pack — no engine edits needed to add
// content of an already-supported kind (multi / order). (A brand-new *kind*
// still needs a renderer in question.tsx + a scorer in answerMulti/answerOrder.)
type FormatEntry = {
  id: string;
  pack: string;
  approved: boolean;
  segment: Question;
};

const FORMAT_REGISTRY: FormatEntry[] = [
  // Multi-select — "pick the N correct". (`correct` is unused for these kinds;
  // kept to satisfy the shared Question shape.)
  { id: "wc-multi-winners", pack: "world-cup", approved: true, segment: { kind: "multi", cat: "Sports", q: "Pick the 3 nations that have WON the World Cup", answers: ["Brazil", "Germany", "Argentina", "Netherlands", "Mexico", "Croatia"], correct: 0, correctSet: [0, 1, 2], pick: 3 } },
  { id: "wc-multi-hosts", pack: "world-cup", approved: true, segment: { kind: "multi", cat: "Sports", q: "Pick the 3 host nations of the 2026 World Cup", answers: ["USA", "Canada", "Mexico", "Qatar", "Brazil", "Spain"], correct: 0, correctSet: [0, 1, 2], pick: 3 } },
  { id: "wc-multi-neverwon", pack: "world-cup", approved: true, segment: { kind: "multi", cat: "Sports", q: "Which 2 of these have NEVER won the World Cup?", answers: ["Spain", "Netherlands", "Italy", "Portugal"], correct: 1, correctSet: [1, 3], pick: 2 } },
  // Ordered-select — arrange into the correct sequence (answers shown scrambled).
  { id: "wc-order-winners", pack: "world-cup", approved: true, segment: { kind: "order", cat: "Sports", q: "Order these World Cup winners — oldest to newest", answers: ["France", "Argentina", "Spain", "Germany"], correct: 0, correctOrder: [2, 3, 0, 1] } },
  { id: "wc-order-hosts", pack: "world-cup", approved: true, segment: { kind: "order", cat: "Sports", q: "Order these World Cup hosts — earliest to latest", answers: ["Russia", "Brazil", "Qatar", "South Africa"], correct: 0, correctOrder: [3, 1, 0, 2] } },
  // Spatial-select — "tap the target" on a board of flag tiles (single correct).
  { id: "wc-spatial-host2022", pack: "world-cup", approved: true, segment: { kind: "spatial", cat: "Sports", q: "Tap the country that HOSTED the 2022 World Cup", answers: ["Russia", "Brazil", "Qatar", "Japan", "Mexico", "Germany"], flags: ["🇷🇺", "🇧🇷", "🇶🇦", "🇯🇵", "🇲🇽", "🇩🇪"], correct: 2 } },
  { id: "wc-spatial-won2018", pack: "world-cup", approved: true, segment: { kind: "spatial", cat: "Sports", q: "Tap the country that WON the 2018 World Cup", answers: ["France", "Croatia", "England", "Belgium", "Brazil", "Argentina"], flags: ["🇫🇷", "🇭🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "🇧🇪", "🇧🇷", "🇦🇷"], correct: 0 } },
  // Graduated from the Format Lab. Trivia Bingo runs on the multi scorer as
  // "tap every TRUE statement" (correctSet = the true cells, pick = its size);
  // Map Click runs on the spatial board.
  { id: "wc-bingo-truth1", pack: "world-cup", approved: true, segment: { kind: "multi", cat: "Sports", q: "BINGO — tap every TRUE statement", answers: ["Brazil have 5 World Cup titles", "Messi won the 2022 final", "The World Cup is held every 2 years", "France won in 2018", "Ronaldo has won a World Cup", "Pelé won three World Cups"], correct: 0, correctSet: [0, 1, 3, 5], pick: 4 } },
  { id: "wc-bingo-truth2", pack: "world-cup", approved: true, segment: { kind: "multi", cat: "Sports", q: "BINGO — tap every TRUE statement", answers: ["Italy have 4 World Cup titles", "Qatar hosted in 2022", "The USA won in 1994", "Germany won in 2014"], correct: 0, correctSet: [0, 1, 3], pick: 3 } },
  { id: "wc-spatial-first1930", pack: "world-cup", approved: true, segment: { kind: "spatial", cat: "Sports", q: "Tap the country that hosted the FIRST World Cup (1930)", answers: ["Uruguay", "Brazil", "Italy", "France", "Argentina", "England"], flags: ["🇺🇾", "🇧🇷", "🇮🇹", "🇫🇷", "🇦🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"], correct: 0 } },
  // Core formats 1–12 from the Format Lab (multiple-choice, true/false, quickfire,
  // mini/big trivia, missing-word, which-of-these, who-am-i, visual-id,
  // get-the-picture, audio-id, minefield) — generated from world-cup/data.ts.
  ...FORMATS.filter((f) => f.num <= 12).flatMap((f) =>
    (f.questions ?? []).map((vq, i) => ({
      id: `wc-fmt-${f.id}-${i}`,
      pack: "world-cup",
      approved: true,
      segment: vqToSegment(vq, f),
    })),
  ),
];

// Approved non-single segments eligible for a pack's live playlist.
const approvedSegments = (pack: string): Question[] =>
  FORMAT_REGISTRY.filter((f) => f.approved && f.pack === pack).map((f) => f.segment);

// Tournament: a fresh set drawn from the active pack. If the pack has approved
// non-single formats, the round becomes a MIXED-FORMAT playlist — mostly
// single-select with a couple of registry segments shuffled in. The default app
// (no pack) stays pure single-select.
function pickTournamentQuestions(n: number): Question[] {
  const pack = THEMES[resolveThemeId()].questionPack;
  const specials = pack ? approvedSegments(pack) : [];
  if (specials.length) {
    const kSpecial = Math.min(2, specials.length, Math.max(1, Math.floor(n / 2)));
    const singles = sample(packPool(), Math.max(0, n - kSpecial)).map(toRuntime);
    const picked = sample(specials, kSpecial);
    return sample([...singles, ...picked], singles.length + picked.length); // shuffle order
  }
  return sample(packPool(), n).map(toRuntime);
}

// Difficulty ramp for a level — early levels stay easy, later levels mix in
// medium and hard so the campaign gets harder as the player climbs.
function levelDifficulties(level: number, n: number): Difficulty[] {
  let pool: Difficulty[];
  if (level < 8) pool = ["easy"];
  else if (level < 16) pool = ["easy", "medium"];
  else if (level < 28) pool = ["medium"];
  else if (level < 40) pool = ["medium", "hard"];
  else pool = ["hard"];
  return Array.from({ length: n }, (_, i) => pool[i % pool.length]);
}

// Level: one question per ramped difficulty slot, no repeats within the level
// (falls back to any unused question if a difficulty tier runs dry).
function pickLevelQuestions(level: number, n: number, pack: string): Question[] {
  const bank = packPool(pack);
  const used = new Set<string>();
  const out: BankQuestion[] = [];
  for (const d of levelDifficulties(level, n)) {
    let pool = bank.filter((q) => q.difficulty === d && !used.has(q.id));
    if (pool.length === 0) pool = bank.filter((q) => !used.has(q.id));
    if (pool.length === 0) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    used.add(pick.id);
    out.push(pick);
  }
  return out.map(toRuntime);
}

// First-tournament-of-the-day 2× XP bonus — an appointment hook that rewards
// opening the app each day. Tracked in localStorage per calendar day so it
// survives reloads and resets at midnight.
const DAILY_BONUS_KEY = "waffles.v2.dailyBonus";
const localDayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function isDailyBonusAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DAILY_BONUS_KEY) !== localDayStr();
  } catch {
    return false;
  }
}
function markDailyBonusUsed(): void {
  try {
    localStorage.setItem(DAILY_BONUS_KEY, localDayStr());
  } catch {
    /* storage disabled — bonus just won't persist */
  }
}

// Announcement read/dismissed state persists in localStorage (like coach marks)
// so the inbox unread dot and dismissed banners survive reloads.
const ANN_READ_KEY = "waffles.v2.ann.read";
const ANN_DISMISSED_KEY = "waffles.v2.ann.dismissed";
const readIdList = (key: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as string[]) : [];
  } catch {
    return [];
  }
};
const writeIdList = (key: string, ids: string[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* storage disabled — state just won't persist this session */
  }
};

// The player's chosen username (set in onboarding), persisted across sessions.
const USERNAME_KEY = "waffles.v2.username";
const readUsername = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(USERNAME_KEY) ?? "";
  } catch {
    return "";
  }
};
const writeUsername = (name: string): void => {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {
    /* storage disabled — won't persist this session */
  }
};

export type Tweaks = {
  questionTime: number;
  questionsPerRound: number;
  levelQuestions: number;
  lobbyCountdown: number;
  startingTickets: number;
  homeSlot: "both" | "continue" | "missions" | "none";
};

export const DEFAULT_TWEAKS: Tweaks = {
  questionTime: 10,
  questionsPerRound: 6,
  levelQuestions: 3,
  lobbyCountdown: 10,
  startingTickets: 3,
  homeSlot: "both",
};

type State = {
  screen: ScreenName;
  prevScreen: ScreenName | null;
  direction: 1 | -1;
  tickets: number;
  // Active solo campaign track (chosen by the levels-page tab) and the current
  // level reached on *each* track — two parallel campaigns with separate
  // progress. proto.level (derived) mirrors the active track's number.
  levelTrack: LevelTrack;
  levelByTrack: Record<LevelTrack, number>;
  // Lives — stake on the level path (see LIVES_MAX). `nextLifeAt` is the epoch-ms
  // the next life regenerates, null when full.
  lives: number;
  nextLifeAt: number | null;
  xp: number;
  streak: number;
  // The player's most recent tournament finishing rank, or null if they've
  // never played one. Powers the "beat your last result" hook on the Home card.
  lastTournamentRank: number | null;
  // Current/most-recent hourly tournament entry, and the unread-able in-app
  // result notifications emitted when rounds settle.
  entry: TournamentEntry | null;
  resultNotifs: ResultNotif[];
  // Tournament prizes won, newest first. Each is resolved by the player from the
  // Prize Wallet (claim as USDT or convert to spendable tickets).
  winnings: Winning[];
  // Announcement ids the player has read (clears the inbox unread dot) and
  // dismissed (hides the Home banner). Seeded from localStorage post-mount.
  annRead: string[];
  annDismissed: string[];
  // The player's chosen handle (set in onboarding). Empty until set; persisted
  // to localStorage and hydrated post-mount.
  username: string;
  // The level that was just unlocked by completing the previous one — drives the
  // one-shot unlock animation on the level path. Cleared after it plays.
  levelJustUnlocked: number | null;
  mode: GameMode;
  hearts: number;
  qIdx: number;
  score: number;
  qAnswered: number | null; // single-select index, -1 timeout, -2 multi submitted, null unanswered
  qSelection: number[] | null; // multi-select picks (set on submit)
  // Power-ups: option indices removed by 50/50 this question; shield absorbs the
  // next wrong answer (level mode) before it costs a heart.
  eliminated: number[];
  shieldActive: boolean;
  countdownSec: number;
  timer: number;
  // The selected questions for the current game (tournament round or level).
  // Repopulated each time a game starts so play never repeats the same set.
  roundQuestions: Question[];
  // True when the current tournament round earns the daily 2× XP bonus.
  tournamentBonus: boolean;
  // Whether the daily-reward sheet is open (driven globally so any screen,
  // e.g. the Home streak chip, can summon it).
  dailyOpen: boolean;
  // Whether the full-page World Cup season takeover is open. Driven globally so
  // the announcement (the persistent re-entry point) can summon it on demand —
  // not just the once-only first-run auto-show.
  wcTakeoverOpen: boolean;
};

const initialState = (tweaks: Tweaks): State => ({
  screen: "home",
  prevScreen: null,
  direction: 1,
  tickets: tweaks.startingTickets,
  levelTrack: "standard",
  // World Cup is a fresh campaign (starts at 1); Standard keeps the seeded 23.
  levelByTrack: { standard: 23, "world-cup": 1 },
  lives: LIVES_MAX,
  nextLifeAt: null,
  xp: 340,
  streak: 12,
  lastTournamentRank: null,
  entry: null,
  resultNotifs: [],
  // Seed a couple of unclaimed prizes so the Prize Wallet has something to show
  // without first having to play a tournament to completion.
  winnings: [
    { id: "seed-1", rank: 7, tickets: 10, wonAt: Date.now() - 3 * 3600_000, status: "pending" },
    { id: "seed-2", rank: 84, tickets: 3, wonAt: Date.now() - 26 * 3600_000, status: "pending" },
  ],
  // Start empty so SSR and the first client render match; hydrated from
  // localStorage in a post-mount effect (see ProtoProvider).
  annRead: [],
  annDismissed: [],
  username: "",
  levelJustUnlocked: null,
  mode: "tournament",
  hearts: 3,
  qIdx: 0,
  score: 0,
  qAnswered: null,
  qSelection: null,
  eliminated: [],
  shieldActive: false,
  countdownSec: tweaks.lobbyCountdown,
  timer: tweaks.questionTime,
  roundQuestions: pickTournamentQuestions(tweaks.questionsPerRound),
  tournamentBonus: false,
  dailyOpen: false,
  wcTakeoverOpen: false,
});

type GotoOpts = { back?: boolean };

export type Proto = State & {
  tweaks: Tweaks;
  currentQuestion: Question;
  totalQuestions: number;
  // The active track's current level — derived from levelByTrack[levelTrack].
  level: number;
  setLevelTrack: (track: LevelTrack) => void;
  goto: (screen: ScreenName, opts?: GotoOpts) => void;
  update: (patch: Partial<State> | ((s: State) => Partial<State>)) => void;
  answerQuestion: (answerIdx: number) => void;
  answerMulti: (indices: number[]) => void;
  answerOrder: (order: number[]) => void;
  startTournament: () => void;
  markResultRead: (id: string) => void;
  claimWinning: (id: string) => void;
  convertWinning: (id: string) => void;
  dismissAnnouncement: (id: string) => void;
  markAnnouncementsRead: (ids: string[]) => void;
  setUsername: (name: string) => void;
  startLevel: () => void;
  beginLevelQuiz: () => void;
  retryLevel: () => void;
  refillLives: () => void;
  playAgain: () => void;
  usePowerUp: (kind: PowerUpName) => void;
};

const ProtoContext = createContext<Proto | null>(null);

export function ProtoProvider({
  tweaks = DEFAULT_TWEAKS,
  children,
}: {
  tweaks?: Tweaks;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>(() => initialState(tweaks));

  const goto = useCallback((screen: ScreenName, opts: GotoOpts = {}) => {
    setState((s) => {
      if (s.screen === screen) return s;
      const fromIdx = SCREEN_ORDER.indexOf(s.screen);
      const toIdx = SCREEN_ORDER.indexOf(screen);
      const direction: 1 | -1 = opts.back ? -1 : toIdx > fromIdx ? 1 : -1;
      return { ...s, prevScreen: s.screen, screen, direction };
    });
  }, []);

  const update = useCallback<Proto["update"]>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  // Hydrate announcement read/dismissed sets from localStorage after mount, so
  // SSR and first render stay matched (both start empty). Done in rAF (before
  // paint, not in the effect body) so there's no flash and no setState-in-effect.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const annRead = readIdList(ANN_READ_KEY);
      const annDismissed = readIdList(ANN_DISMISSED_KEY);
      const username = readUsername();
      const patch: Partial<State> = {};
      if (annRead.length || annDismissed.length) {
        patch.annRead = annRead;
        patch.annDismissed = annDismissed;
      }
      if (username) patch.username = username;
      if (Object.keys(patch).length) update(patch);
    });
    return () => cancelAnimationFrame(id);
  }, [update]);

  // Hydrate real player state from the server after mount, overlaying the mock
  // seed. No-ops in the preview / unauthenticated context (loadV2State → null),
  // so the screens still render and demo on local state.
  useEffect(() => {
    let active = true;
    loadV2State()
      .then((s) => {
        if (!active || !s) return;
        update({
          tickets: s.tickets,
          xp: s.xp,
          streak: s.streak,
          lives: s.lives,
          nextLifeAt: s.nextLifeAt,
          username: s.username,
          levelByTrack: s.levelByTrack,
          winnings: s.winnings,
          lastTournamentRank: s.lastTournamentRank,
          annRead: s.annRead,
          annDismissed: s.annDismissed,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [update]);

  // Lobby countdown
  useEffect(() => {
    if (state.screen !== "lobby") return;
    if (state.countdownSec <= 0) {
      const t = setTimeout(() => {
        update({ qIdx: 0, score: 0, qAnswered: null, qSelection: null, eliminated: [], shieldActive: false, timer: state.roundQuestions[0]?.time ?? tweaks.questionTime });
        goto("question");
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => update({ countdownSec: state.countdownSec - 1 }), 1000);
    return () => clearTimeout(t);
  }, [state.screen, state.countdownSec, state.roundQuestions, tweaks.questionTime, goto, update]);

  // Question timer
  useEffect(() => {
    if (state.screen !== "question") return;
    if (state.qAnswered !== null) return;
    if (state.timer <= 0) {
      const t = setTimeout(() => update({ qAnswered: -1 }), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => update({ timer: state.timer - 0.1 }), 100);
    return () => clearTimeout(t);
  }, [state.screen, state.timer, state.qAnswered, update]);

  // While not full, reconcile regenerated lives every second so the meter fills
  // and the "next life" countdown stays live. No interval when full.
  useEffect(() => {
    if (state.lives >= LIVES_MAX) return;
    const id = setInterval(() => update((s) => regenLives(s.lives, s.nextLifeAt, Date.now())), 1000);
    return () => clearInterval(id);
  }, [state.lives, update]);

  // Auto-advance after answer
  useEffect(() => {
    if (state.qAnswered === null) return;
    if (state.screen !== "question") return;
    const t = setTimeout(() => {
      const q = state.roundQuestions[state.qIdx];
      if (!q) return;
      const right =
        state.qAnswered === -1
          ? false
          : q.kind === "multi"
            ? (() => {
                const sel = state.qSelection ?? [];
                const cs = q.correctSet ?? [];
                return sel.length === cs.length && sel.every((i) => cs.includes(i));
              })()
            : q.kind === "order"
              ? (() => {
                  const seq = state.qSelection ?? [];
                  const co = q.correctOrder ?? [];
                  return seq.length === co.length && seq.every((v, p) => v === co[p]);
                })()
              : state.qAnswered === q.correct;
      const wrong = !right;
      const totalQs = state.roundQuestions.length;

      if (state.mode === "level") {
        // Shield absorbs one wrong answer instead of costing a heart.
        const shielded = wrong && state.shieldActive;
        const newHearts = wrong && !state.shieldActive ? state.hearts - 1 : state.hearts;
        if (newHearts <= 0) {
          // Failing a level costs a life; start the regen clock if we were full.
          const wasFull = state.lives >= LIVES_MAX;
          update({
            hearts: 0,
            lives: Math.max(0, state.lives - 1),
            nextLifeAt: wasFull ? Date.now() + LIFE_REGEN_MS : state.nextLifeAt,
          });
          void v2LoseLife(); // persist the life loss (regen clock is server-side too)
          goto("levelFail");
          return;
        }
        if (state.qIdx + 1 >= totalQs) {
          const track = state.levelTrack;
          const newLevel = state.levelByTrack[track] + 1;
          // Curved free-ticket milestone — actually credited now (was previously
          // only promised in the UI). Advances only the active track.
          const milestoneTicket = isLevelTicketMilestone(newLevel) ? 1 : 0;
          update({ hearts: newHearts, levelByTrack: { ...state.levelByTrack, [track]: newLevel }, xp: state.xp + state.score, tickets: state.tickets + milestoneTicket, levelJustUnlocked: newLevel });
          // Persist: advanceLevel credits the same milestone ticket + xp server-side.
          void v2AdvanceLevel(track, state.score);
          goto("levelWin");
          return;
        }
        update({
          hearts: newHearts,
          qIdx: state.qIdx + 1,
          qAnswered: null,
          qSelection: null,
          eliminated: [],
          shieldActive: shielded ? false : state.shieldActive,
          timer: state.roundQuestions[state.qIdx + 1]?.time ?? tweaks.questionTime,
        });
        return;
      }

      if (state.qIdx + 1 >= totalQs) {
        // Finishing posts a PROVISIONAL score — the prize is NOT awarded here.
        // The round is still live; rank/prize lock at settlement (round close).
        // XP is score-based (not rank-dependent), so it's the instant reward and
        // is credited now along with the 2× bonus consumption.
        const xpMult = state.tournamentBonus ? 2 : 1;
        if (state.tournamentBonus) markDailyBonusUsed();
        // Post the provisional score to the server entry; settlement (rank/prize)
        // is server-authoritative at round close (see lib/v2/rounds.settleRound).
        if (state.entry) void v2SubmitRoundScore(state.entry.roundId, state.score);
        // Daily mission accrual — questions answered this round.
        void v2RecordMissionProgress("daily-answer-5", totalQs);
        void v2RecordMissionProgress("daily-answer-3", totalQs);
        goto("results");
        update((s) => ({
          xp: s.xp + s.score * xpMult,
          entry: s.entry ? { ...s.entry, score: s.score } : s.entry,
        }));
      } else {
        update({
          qIdx: state.qIdx + 1,
          qAnswered: null,
          qSelection: null,
          eliminated: [],
          timer: state.roundQuestions[state.qIdx + 1]?.time ?? tweaks.questionTime,
        });
      }
    }, 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.qAnswered, state.qIdx]);

  const answerQuestion = (answerIdx: number) => {
    if (state.qAnswered !== null) return;
    const q = state.roundQuestions[state.qIdx];
    if (!q) return;
    const correct = answerIdx === q.correct;
    // Minefield is the high-risk format: a correct answer pays 1.5×, a wrong one
    // not only scores 0 but docks 150 (floored at 0) — "kills your run".
    const base = Math.round(100 + state.timer * 20);
    const delta = q.minefield
      ? correct
        ? Math.round(base * 1.5)
        : -150
      : correct
        ? base
        : 0;
    update({
      qAnswered: answerIdx,
      score: Math.max(0, state.score + delta),
    });
  };

  // Multi-select submit. Normalized to the SAME ceiling as a single question
  // (100 + timer×20) × accuracy, so no format is worth disproportionately more.
  // accuracy = (correct picks − wrong picks) / required, clamped 0..1.
  const answerMulti = (indices: number[]) => {
    if (state.qAnswered !== null) return;
    const q = state.roundQuestions[state.qIdx];
    if (!q || q.kind !== "multi") return;
    const cs = q.correctSet ?? [];
    const pick = q.pick ?? cs.length;
    const correctPicked = indices.filter((i) => cs.includes(i)).length;
    const wrongPicked = indices.filter((i) => !cs.includes(i)).length;
    const accuracy = Math.max(0, Math.min(1, (correctPicked - wrongPicked) / pick));
    const base = Math.round(100 + state.timer * 20);
    update({
      qAnswered: -2,
      qSelection: indices,
      score: state.score + Math.round(base * accuracy),
    });
  };

  // Ordered-select submit. Same normalized ceiling; accuracy = fraction of items
  // placed in their correct position.
  const answerOrder = (order: number[]) => {
    if (state.qAnswered !== null) return;
    const q = state.roundQuestions[state.qIdx];
    if (!q || q.kind !== "order") return;
    const co = q.correctOrder ?? [];
    const n = co.length || 1;
    const matches = order.filter((v, p) => v === co[p]).length;
    const accuracy = Math.max(0, Math.min(1, matches / n));
    const base = Math.round(100 + state.timer * 20);
    update({
      qAnswered: -3,
      qSelection: order,
      score: state.score + Math.round(base * accuracy),
    });
  };

  // Spends one ticket and drops into the lobby. Callers are responsible for
  // gating on balance first (the Home join sheet does); we clamp at 0 so a
  // stray call can never push the balance negative.
  const startTournament = () => {
    // One paid entry per round. If they already entered this round and it hasn't
    // settled, re-tapping shows their standing instead of charging/replaying.
    const rid = roundIdFor(Date.now());
    if (state.entry && state.entry.roundId === rid && !state.entry.settled) {
      goto("results");
      return;
    }
    const bonus = isDailyBonusAvailable();
    update((s) => ({
      tickets: Math.max(0, s.tickets - TOURNAMENT_TICKET_COST),
      mode: "tournament",
      countdownSec: tweaks.lobbyCountdown,
      qIdx: 0,
      score: 0,
      qAnswered: null,
      hearts: 3,
      timer: tweaks.questionTime,
      roundQuestions: pickTournamentQuestions(tweaks.questionsPerRound),
      // First tournament of the day earns 2× XP.
      tournamentBonus: bonus,
      entry: { roundId: rid, score: null, bonus, settled: false, finalRank: null, reward: null },
    }));
    // Persist the entry server-side (charges a ticket; re-entry is a no-op
    // server-side too). Optimistic local charge above keeps the UI instant.
    void v2EnterRound(rid, bonus);
    goto("lobby");
  };

  // Settle the active entry when its round closes: lock the final rank, pay any
  // prize to the Prize Wallet, and emit an in-app result notification (for every
  // outcome). Runs while an unsettled entry exists; also settles immediately if
  // the player returns after close.
  useEffect(() => {
    const e = state.entry;
    if (!e || e.settled) return;
    const close = roundCloseAt(e.roundId);
    const settle = () => {
      if (Date.now() < close) return;
      update((s) => {
        const en = s.entry;
        if (!en || en.settled) return {};
        if (en.score == null) {
          // Entered but never finished — forfeit, no result notification.
          return { entry: { ...en, settled: true, finalRank: null, reward: 0 } };
        }
        const finalRank = tournamentRank(en.score, tweaks.questionsPerRound);
        const reward = tournamentReward(finalRank);
        return {
          entry: { ...en, settled: true, finalRank, reward },
          lastTournamentRank: finalRank,
          winnings: reward > 0
            ? [{ id: `w-${en.roundId}`, rank: finalRank, tickets: reward, wonAt: Date.now(), status: "pending" as const }, ...s.winnings]
            : s.winnings,
          resultNotifs: [{ id: `r-${en.roundId}`, roundId: en.roundId, rank: finalRank, reward, read: false }, ...s.resultNotifs],
        };
      });
    };
    settle();
    const id = setInterval(settle, 1000);
    return () => clearInterval(id);
  }, [state.entry, update, tweaks.questionsPerRound]);

  const markResultRead = (id: string) => {
    update((s) => ({ resultNotifs: s.resultNotifs.map((r) => (r.id === id ? { ...r, read: true } : r)) }));
  };

  // Claim a winning as USDT. Optimistic locally; the server marks it resolved
  // (the on-chain USDT transfer runs via the existing merkle-claim path).
  const claimWinning = (id: string) => {
    void v2ResolveWinning(id, "claim");
    update((s) => ({
      winnings: s.winnings.map((w) => (w.id === id && w.status === "pending" ? { ...w, status: "claimed" } : w)),
    }));
  };

  // Convert a winning into spendable in-app tickets instead of claiming USDT.
  const convertWinning = (id: string) => {
    void v2ResolveWinning(id, "convert");
    update((s) => {
      const w = s.winnings.find((x) => x.id === id && x.status === "pending");
      if (!w) return {};
      return {
        tickets: s.tickets + w.tickets,
        winnings: s.winnings.map((x) => (x.id === id ? { ...x, status: "converted" } : x)),
      };
    });
  };

  // Hide a banner announcement; persisted so it stays hidden next session.
  const dismissAnnouncement = (id: string) => {
    void v2DismissAnnouncement(id);
    update((s) => {
      if (s.annDismissed.includes(id)) return {};
      const next = [...s.annDismissed, id];
      writeIdList(ANN_DISMISSED_KEY, next);
      return { annDismissed: next };
    });
  };

  // Mark announcements read (clears the inbox unread dot); persisted.
  const markAnnouncementsRead = (ids: string[]) => {
    void v2SetAnnouncementsRead(ids);
    update((s) => {
      const next = Array.from(new Set([...s.annRead, ...ids]));
      if (next.length === s.annRead.length) return {};
      writeIdList(ANN_READ_KEY, next);
      return { annRead: next };
    });
  };

  // Both entry points gate on lives: at 0 we reconcile any regen and route to the
  // level path (where the refill / wait UI lives) instead of starting a run the
  // player can't afford to fail.
  const enterLevel = () => {
    const r = regenLives(state.lives, state.nextLifeAt, Date.now());
    if (r.lives <= 0) {
      update(r);
      goto("levels");
      return;
    }
    update({ ...r, mode: "level", qIdx: 0, score: 0, qAnswered: null, hearts: 3, timer: tweaks.questionTime });
    goto("levelIntro");
  };
  const startLevel = enterLevel;
  const retryLevel = enterLevel;

  const refillLives = () => {
    void v2RefillLives();
    update((s) => {
      if (s.lives >= LIVES_MAX || s.tickets < LIVES_REFILL_COST) return {};
      return { tickets: s.tickets - LIVES_REFILL_COST, lives: LIVES_MAX, nextLifeAt: null };
    });
  };

  const beginLevelQuiz = () => {
    update((s) => {
      const rq = pickLevelQuestions(s.levelByTrack[s.levelTrack], tweaks.levelQuestions, TRACK_PACK[s.levelTrack]);
      return {
        qIdx: 0,
        score: 0,
        qAnswered: null,
        eliminated: [],
        shieldActive: false,
        timer: rq[0]?.time ?? tweaks.questionTime,
        roundQuestions: rq,
      };
    });
    goto("question");
  };

  // Activate a shop power-up in the live quiz (consumes one from inventory).
  const usePowerUp = (kind: PowerUpName) => {
    void v2ConsumePowerUp(kind);
    if (kind === "EXTRA_TIME") {
      update((s) => ({ timer: s.timer + 5 }));
      return;
    }
    if (kind === "SHIELD") {
      update({ shieldActive: true });
      return;
    }
    if (kind === "FIFTY_FIFTY") {
      const q = state.roundQuestions[state.qIdx];
      if (q && (q.kind ?? "single") === "single" && state.qAnswered === null) {
        const wrongIdx = q.answers.map((_, i) => i).filter((i) => i !== q.correct);
        update({ eliminated: sample(wrongIdx, Math.min(2, wrongIdx.length)) });
      }
      return;
    }
    if (kind === "SKIP") {
      update((s) => {
        if (s.qAnswered !== null || s.qIdx + 1 >= s.roundQuestions.length) return {}; // can't skip after answering or on the last Q
        return {
          qIdx: s.qIdx + 1,
          qAnswered: null,
          qSelection: null,
          eliminated: [],
          timer: s.roundQuestions[s.qIdx + 1]?.time ?? tweaks.questionTime,
        };
      });
    }
  };

  const playAgain = () => {
    update({
      mode: "tournament",
      qIdx: 0,
      score: 0,
      qAnswered: null,
      hearts: 3,
      timer: tweaks.questionTime,
      countdownSec: tweaks.lobbyCountdown,
      roundQuestions: pickTournamentQuestions(tweaks.questionsPerRound),
      tournamentBonus: false,
    });
    goto("home");
  };

  const setLevelTrack = (track: LevelTrack) => update({ levelTrack: track });

  // Persist + apply the player's chosen username.
  const setUsername = (name: string) => {
    const clean = name.trim();
    writeUsername(clean);
    void v2SetUsername(clean);
    update({ username: clean });
  };

  const value: Proto = {
    ...state,
    tweaks,
    currentQuestion: state.roundQuestions[state.qIdx] ?? state.roundQuestions[0] ?? QUESTIONS[0],
    totalQuestions: state.roundQuestions.length,
    level: state.levelByTrack[state.levelTrack],
    setLevelTrack,
    goto,
    update,
    answerQuestion,
    answerMulti,
    answerOrder,
    startTournament,
    markResultRead,
    claimWinning,
    convertWinning,
    dismissAnnouncement,
    markAnnouncementsRead,
    setUsername,
    startLevel,
    beginLevelQuiz,
    retryLevel,
    refillLives,
    playAgain,
    usePowerUp,
  };

  return <ProtoContext.Provider value={value}>{children}</ProtoContext.Provider>;
}

export function useProto(): Proto {
  const ctx = useContext(ProtoContext);
  if (!ctx) throw new Error("useProto must be used inside <ProtoProvider>");
  return ctx;
}
