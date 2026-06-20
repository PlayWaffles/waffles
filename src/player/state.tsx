"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type VMedia } from "./world-cup/data";
import { THEMES, resolveThemeId } from "./theme";
import {
  loadState,
  advanceLevel,
  // Aliased: these collide with same-named local proto methods below whose
  // bodies call the server action (e.g. local `refillLives` → `refillLivesAction`).
  dismissAnnouncement as dismissAnnouncementAction,
  getLevelQuestions,
  recordLevelPlay,
  getTournament,
  enterTournament,
  submitTournamentAnswers,
  getTournamentClaim,
  confirmTournamentClaim,
  reconcileTournamentClaim,
  loseLife,
  consumePowerUp,
  recordMissionEvent,
  refillLives as refillLivesAction,
  setAnnouncementsRead,
  loadAnnouncements,
  setUsername as setUsernameAction,
  logClient,
} from "@/actions/player";
import { type Announcement } from "./announcements";
import { useTournamentWallet, type TournamentTxStep } from "./useTournamentWallet";
import { useUser } from "@/hooks/useUser";
import { assertChainPlatform } from "@/lib/chain/platform";
import {
  AnalyticsEvent,
  type AnalyticsEventName,
  hashAnalyticsValue,
  trackClientEvent,
  type AnalyticsProperties,
} from "@/lib/analytics";

// Forward the buy-ticket flow trace to the SERVER terminal (these run in the
// browser). Errors are flattened since Error objects don't cross the RSC wire.
const blog = (msg: string, data?: unknown) => {
  const safe =
    data instanceof Error
      ? `${(data as { shortMessage?: string }).shortMessage ?? data.message}\n${data.stack ?? ""}`.slice(0, 1500)
      : data;
  void logClient(msg, safe);
};

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

// Below this many *real* entrants a round is too empty to show its true
// headcount (a lone "1 playing" kills the live feel), so the simulated field is
// shown instead. At/above it, the genuine count is surfaced.
export const FIELD_REVEAL_MIN = 10;
export function displayFieldSize(realCount: number): number {
  return realCount >= FIELD_REVEAL_MIN ? realCount : TOURNAMENT_FIELD_SIZE;
}

// Prize ladder: finishing rank → tickets won. Risking 1 ticket to enter for a
// shot at 25 is the stakes hook we sell on the Home card. Ordered best tier
// first; `tournamentReward` returns the first tier the rank clears.
export type PrizeTier = { maxRank: number; tickets: number; label: string };
export const TOURNAMENT_PRIZES: PrizeTier[] = [
  { maxRank: 1, tickets: 25, label: "1st" },
  { maxRank: 10, tickets: 10, label: "Top 10" },
  { maxRank: 100, tickets: 3, label: "Top 100" },
];
// Headline "win up to" figure.
export const TOURNAMENT_TOP_PRIZE = TOURNAMENT_PRIZES[0].tickets;

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
// Display label for a real cash value, e.g. "2.50 USDT". Used for on-chain
// winnings (the Prize Wallet) — NOT for the off-chain soft currency below.
export function usdtLabel(tickets: number): string {
  return `${ticketsToUsdt(tickets).toFixed(2)} USDT`;
}

// "Syrup" is the off-chain soft currency (earned by playing; spent on lives,
// power-ups for solo levels, and cosmetics). It is NOT money and has no cash
// value — show the plain count, paired with <SyrupIcon>. (Internally still
// `ticketBalance` / TicketLedgerReason; this is the display name only.)
export const SYRUP_NAME = "Syrup";
export function syrupLabel(amount: number): string {
  return `${amount} ${SYRUP_NAME}`;
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
  // No questions answered yet (just entered, haven't played) → bottom of the
  // field rather than NaN from a 0/0 divide.
  if (!totalQuestions || totalQuestions <= 0) return TOURNAMENT_FIELD_SIZE;
  return Math.max(1, Math.round(TOURNAMENT_FIELD_SIZE * (1 - Math.min(1, score / (totalQuestions * 250)))) + 1);
}

// Syrup (off-chain reward) everyone earns for PLAYING a tournament round — extra
// on top of the cash prize, so non-winners still walk away with something. A
// small flat participation base + a score bonus. Winners get an additional
// boost at settlement (see TOURNAMENT_WINNER_SYRUP_BONUS in lifecycle.ts).
// NOTE: keep this in sync with the same formula in submitTournamentAnswers
// (tournamentGames.ts) — that server path is the authoritative grant.
export function tournamentSyrupReward(score: number): number {
  return 10 + Math.round(Math.max(0, score) / 100);
}

// Bucket a wallet error into a coarse, PII-free reason for the purchase funnel.
// The wallet hook surfaces friendly copy ("Cancelled." / low-balance), so match
// on those plus the raw on-chain phrases as a fallback.
export function classifyWalletError(message: string): string {
  const m = message.toLowerCase();
  if (/cancel|user rejected|denied|rejected the request/.test(m)) return "user_rejected";
  if (/insufficient|not enough|balance|low.*celo|low.*usdc/.test(m)) return "insufficient_balance";
  if (/chain|network/.test(m)) return "wrong_chain";
  return "wallet_error";
}

// ─── Hourly display windows ─────────────────────────────────────────────────
// Client helpers for bucketed top-of-hour display copy. On-chain tournament
// settlement is driven by GameEntry/game lifecycle state, not this local clock.
export const TOURNAMENT_ROUND_MS = 60 * 60 * 1000;
export const roundIdFor = (now: number): number => Math.floor(now / TOURNAMENT_ROUND_MS) * TOURNAMENT_ROUND_MS;
export const roundCloseAt = (roundId: number): number => roundId + TOURNAMENT_ROUND_MS;

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
  // Server-issued question id, present for DB-served sets (tournament rounds via
  // `getTournamentClientQuestions`, solo levels via `getLevelClientQuestions`).
  // The answers a player gives are submitted keyed by this id so the server can
  // re-score them authoritatively.
  id?: string;
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
  // Real image URL (DB-backed questions, e.g. Visual ID / Get the Picture).
  // Distinct from `media` (the Format Lab's hardcoded illustrations).
  image?: string;
  time?: number;
  minefield?: boolean;
};

// One submitted tournament answer, sent to the server for authoritative
// re-scoring. `selection` is normalized to an index array: single/spatial =
// [chosenIndex] (empty = timeout), multi = chosen picks, order = chosen
// sequence. Mirrors `RoundAnswer` in src/lib/v2/scoring.ts.
export type RoundAnswer = {
  id: string;
  selection: number[];
  responseMs: number;
};

// Neutral type-satisfying placeholder for `currentQuestion` when no quiz is
// active (roundQuestions empty). NOT trivia content — live quizzes always have
// server-issued questions before the question screen renders.
const EMPTY_QUESTION: Question = { cat: "", q: "", answers: ["", "", "", ""], correct: 0 };

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

// (Live-play questions are now server-only — both the level path and tournament
// rounds fetch from the DB. The local QUESTION_BANK / FORMATS / FORMAT_REGISTRY
// machinery that used to seed mock content has been removed; QUESTION_BANK and
// FORMATS remain only in the Format Lab / showcase, not in the live app.)

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

// Announcement read/dismissed state is DB-backed (AnnouncementState): loaded via
// loadState() and written through the server actions, so it's authoritative and
// cross-device. Triggered ("auto:") cards are session-only (no DB row), so their
// dismissal lives in proto state for the session and re-evaluates on reload.

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
  levelQuestions: 4,
  lobbyCountdown: 10,
  startingTickets: 0,
  homeSlot: "both",
};

type State = {
  // True once durable player state has been loaded from the server at least
  // once. The app shell holds a loader until this flips, so screens never render
  // on the pre-load seed values (server-authoritative; no mock fallback).
  hydrated: boolean;
  // Transient global toast (auto-clears). Used e.g. when a level's server
  // questions can't load — we bail rather than play mock content.
  toast: string | null;
  // True while a level's questions are being fetched on demand (BEGIN tapped
  // before the intro prefetch landed), so the intro can show a loading state.
  levelLoading: boolean;
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
  // Unread-able in-app result notifications emitted when tournament games settle.
  resultNotifs: ResultNotif[];
  // Tournament prizes won, newest first. Each is resolved by the player from the
  // Prize Wallet (claim as USDT or convert to spendable tickets).
  winnings: Winning[];
  // Announcement ids the player has read (clears the inbox unread dot) and
  // dismissed (hides the Home banner). DB-backed (AnnouncementState), overlaid
  // from loadState once a session resolves.
  annRead: string[];
  annDismissed: string[];
  // Earned badge ids — DB-backed (UserBadge), overlaid from loadState. The
  // authoritative set; badge displays union this with any freshly-derived badge.
  earnedBadges: string[];
  // The live announcement feed (authored DB rows + per-user triggered cards),
  // fetched from the server. Empty until that load resolves.
  announcements: Announcement[];
  // The player's chosen handle (set in onboarding). Empty until set; persisted
  // to localStorage and hydrated post-mount.
  username: string;
  // Assigned avatar id (random at account creation); resolved to an image via
  // resolveAvatar(). Null only for accounts predating avatar assignment, which
  // fall back to a deterministic pick.
  avatarId: string | null;
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
  // Per-question answers given in the current tournament round, accumulated as
  // the player answers and submitted at finish so the server can re-score them
  // authoritatively (the client never posts its own score). Keyed by the
  // server-issued question id; empty for level play.
  roundAnswers: RoundAnswer[];
  // Server-fetched questions for the level being entered, prefetched during the
  // level-intro screen so `beginLevelQuiz` can start instantly. Null until the
  // fetch resolves (falls back to the local bank if it never does).
  pendingLevelQuestions: Question[] | null;
  // The on-chain tournament `Game` id when the current round was entered via the
  // on-chain path (real USDC deposit). Set by `enterTournamentOnChain`; routes
  // the finish-submit to the server-authoritative on-chain scorer.
  tournamentGameId: string | null;
  // Live progress of the current on-chain entry/claim (approve → pay → confirm →
  // verify), so the UI can narrate the multi-step wallet flow. Null when idle.
  tournamentStep: TournamentTxStep | null;
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
  hydrated: false,
  toast: null,
  levelLoading: false,
  screen: "home",
  prevScreen: null,
  direction: 1,
  tickets: tweaks.startingTickets,
  levelTrack: "world-cup",
  // Both tracks start fresh at level 1; real progress overlays from the server
  // once loadState resolves.
  levelByTrack: { standard: 1, "world-cup": 1 },
  lives: LIVES_MAX,
  nextLifeAt: null,
  // Clean new-player seed: real values overlay from the server once
  // loadState resolves (logged-out / pre-load shows a fresh account).
  xp: 0,
  streak: 0,
  lastTournamentRank: null,
  resultNotifs: [],
  winnings: [],
  // Start empty so SSR and the first client render match; overlaid from the DB
  // (AnnouncementState via loadState) once a session resolves.
  annRead: [],
  annDismissed: [],
  earnedBadges: [],
  // Empty until the DB feed loads (loadAnnouncements) — fully server-driven.
  announcements: [],
  username: "",
  avatarId: null,
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
  roundQuestions: [], // server-issued on tournament entry; never seeded locally
  roundAnswers: [],
  pendingLevelQuestions: null,
  tournamentGameId: null,
  tournamentStep: null,
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
  // On-chain tournament: deposit via wallet (buyTicket) + start the round; claim
  // a settled prize via the merkle proof. Resolve with ok/error for the UI.
  enterTournamentOnChain: () => Promise<{ ok: boolean; error?: string }>;
  playEnteredTournament: () => Promise<{ ok: boolean; error?: string }>;
  claimTournamentPrize: (gameId: string) => Promise<{ ok: boolean; error?: string }>;
  markResultRead: (id: string) => void;
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

function questionAnalytics(
  q: Question | undefined,
  properties: AnalyticsProperties = {},
): AnalyticsProperties {
  return {
    question_format: q?.kind ?? "single",
    category: q?.cat,
    question_id: hashAnalyticsValue(q?.q),
    answer_count: q?.answers.length,
    timer_start_sec: q?.time,
    ...properties,
  };
}

export function ProtoProvider({
  tweaks = DEFAULT_TWEAKS,
  children,
}: {
  tweaks?: Tweaks;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>(() => initialState(tweaks));
  // Auth-readiness signal. Server actions authenticate ONLY via the session
  // cookie, which the Stage shell establishes asynchronously (wallet signature →
  // /auth/verify → refetch). `user.id` flips non-null once that session exists,
  // so we key the real-data fetch below on it — otherwise a fetch fired during
  // the sign-in race resolves null and the app stays stuck on mock/default state
  // until a full reload (this is the systemic cause behind the "shop loads
  // forever" symptom, which just made it visible by hard-gating its UI).
  const { user } = useUser();
  const authedUserId = user?.id ?? null;
  const shellTrackedRef = useRef(false);
  const questionStartRef = useRef<string | null>(null);
  const screenViewedRef = useRef<string | null>(null);
  // Fires TournamentStarted exactly once per round (keyed by game id) when the
  // lobby countdown hands off to the first question.
  const tournamentStartedRef = useRef<string | null>(null);
  // Tracks the screen the player is currently dwelling on + when they arrived,
  // so we can emit a dwell-duration event when they leave it (any screen,
  // profile included).
  const screenDwellRef = useRef<{ screen: ScreenName; at: number } | null>(null);
  // On-chain wallet (buyTicket entry + claimPrize) — reuses v1's contract layer.
  const tournamentWallet = useTournamentWallet();

  const track = useCallback(
    (event: AnalyticsEventName, properties: AnalyticsProperties = {}) => {
      trackClientEvent(event, {
        screen: state.screen,
        source_screen: state.prevScreen,
        is_authenticated: Boolean(state.username),
        wallet_connected: null,
        theme_id: resolveThemeId(),
        season: THEMES[resolveThemeId()].id,
        tickets_balance: state.tickets,
        xp: state.xp,
        level: state.levelByTrack[state.levelTrack],
        level_track: state.levelTrack,
        lives: state.lives,
        streak_days: state.streak,
        mode: state.mode,
        game_id: state.tournamentGameId,
        ...properties,
      });
    },
    [state],
  );

  const goto = useCallback((screen: ScreenName, opts: GotoOpts = {}) => {
    setState((s) => {
      if (s.screen === screen) return s;
      const fromIdx = SCREEN_ORDER.indexOf(s.screen);
      const toIdx = SCREEN_ORDER.indexOf(screen);
      const direction: 1 | -1 = opts.back ? -1 : toIdx > fromIdx ? 1 : -1;
      return { ...s, prevScreen: s.screen, screen, direction };
    });
    if (opts.back) {
      track(AnalyticsEvent.ScreenBackClicked, { target_screen: screen });
    }
  }, [track]);

  const update = useCallback<Proto["update"]>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));
  }, []);

  // One-shot shell-loaded telemetry on mount.
  useEffect(() => {
    if (!shellTrackedRef.current) {
      shellTrackedRef.current = true;
      track(AnalyticsEvent.ShellLoaded, { entry_reason: "mount" });
    }
  }, [track]);

  useEffect(() => {
    const key = `${state.prevScreen ?? "none"}:${state.screen}`;
    if (screenViewedRef.current === key) return;
    screenViewedRef.current = key;
    // Emit dwell time for the screen we're leaving, then start the clock on the
    // one we just landed on (drives "how long do they stay in profile" etc.).
    const prev = screenDwellRef.current;
    if (prev && prev.screen !== state.screen) {
      track(AnalyticsEvent.ScreenDwellRecorded, {
        screen: prev.screen,
        next_screen: state.screen,
        dwell_ms: Date.now() - prev.at,
      });
    }
    screenDwellRef.current = { screen: state.screen, at: Date.now() };
    track(AnalyticsEvent.ScreenViewed, {
      screen: state.screen,
      previous_screen: state.prevScreen,
    });
  }, [state.prevScreen, state.screen, track]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      // Announcement read/dismissed state is loaded from the DB (loadState); only
      // the username still hydrates from localStorage here.
      const username = readUsername();
      if (username) update({ username });
    });
    return () => cancelAnimationFrame(id);
  }, [update]);

  // Hydrate real player state from the server after a confirmed session lands
  // (authedUserId). The shell gates all screens behind `hydrated`, so this is
  // the single source of the player's real data — there is no mock fallback.
  // `hydrated` flips on settle (success OR failure) so the app can never hang on
  // the loader; a failed load just proceeds on the seed and self-heals on refetch.
  useEffect(() => {
    if (!authedUserId) return;
    let active = true;
    loadState()
      .then((s) => {
        if (!active || !s) return;
        update({
          tickets: s.tickets,
          xp: s.xp,
          streak: s.streak,
          lives: s.lives,
          nextLifeAt: s.nextLifeAt,
          username: s.username,
          avatarId: s.avatarId,
          levelByTrack: s.levelByTrack,
          winnings: s.winnings,
          lastTournamentRank: s.lastTournamentRank,
          annRead: s.annRead,
          annDismissed: s.annDismissed,
          earnedBadges: s.earnedBadges,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) update({ hydrated: true });
      });
    return () => {
      active = false;
    };
  }, [authedUserId, update]);

  // Auto-dismiss the transient global toast.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => update({ toast: null }), 2800);
    return () => clearTimeout(t);
  }, [state.toast, update]);

  // Fetch the live announcement feed (authored DB rows + per-user triggered
  // cards). Runs on mount for authored content and refetches once a session
  // lands so triggered cards (e.g. unclaimed prize) appear. The DB is the sole
  // source of truth — an empty result clears the feed.
  useEffect(() => {
    let active = true;
    loadAnnouncements()
      .then((list) => {
        if (active && list) update({ announcements: list });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authedUserId, update]);

  useEffect(() => {
    if (state.screen !== "question" || state.qAnswered !== null) return;
    const q = state.roundQuestions[state.qIdx];
    const key = `${state.mode}:${state.tournamentGameId ?? state.levelTrack}:${state.qIdx}:${q?.q ?? ""}`;
    if (questionStartRef.current === key) return;
    questionStartRef.current = key;
    track(
      state.mode === "level"
        ? AnalyticsEvent.LevelQuestionStarted
        : AnalyticsEvent.TournamentQuestionStarted,
      questionAnalytics(q, {
        question_index: state.qIdx + 1,
        question_count: state.roundQuestions.length,
        level_number: state.levelByTrack[state.levelTrack],
        timer_start_sec: q?.time ?? tweaks.questionTime,
      }),
    );
  }, [state.levelByTrack, state.levelTrack, state.mode, state.qAnswered, state.qIdx, state.roundQuestions, state.screen, state.tournamentGameId, tweaks.questionTime, track]);

  // Lobby countdown
  useEffect(() => {
    if (state.screen !== "lobby") return;
    if (state.countdownSec <= 0) {
      if (state.mode === "tournament") {
        const startKey = state.tournamentGameId ?? "local";
        if (tournamentStartedRef.current !== startKey) {
          tournamentStartedRef.current = startKey;
          track(AnalyticsEvent.TournamentStarted, {
            game_id: state.tournamentGameId,
            question_count: state.roundQuestions.length,
            on_chain: Boolean(state.tournamentGameId),
          });
        }
      }
      const t = setTimeout(() => {
        update({ qIdx: 0, score: 0, qAnswered: null, qSelection: null, eliminated: [], shieldActive: false, timer: state.roundQuestions[0]?.time ?? tweaks.questionTime });
        goto("question");
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => update({ countdownSec: state.countdownSec - 1 }), 1000);
    return () => clearTimeout(t);
  }, [state.screen, state.countdownSec, state.roundQuestions, state.mode, state.tournamentGameId, tweaks.questionTime, goto, update, track]);

  // Question timer
  useEffect(() => {
    if (state.screen !== "question") return;
    if (state.qAnswered !== null) return;
    if (state.timer <= 0) {
      const t = setTimeout(() => {
        const q = state.roundQuestions[state.qIdx];
        track(AnalyticsEvent.QuestionTimeout, questionAnalytics(q, {
          question_index: state.qIdx + 1,
          question_count: state.roundQuestions.length,
          time_remaining_sec: 0,
          score_after: state.score,
        }));
        update({ qAnswered: -1 });
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => update({ timer: state.timer - 0.1 }), 100);
    return () => clearTimeout(t);
  }, [state.screen, state.timer, state.qAnswered, state.roundQuestions, state.qIdx, state.score, update, track]);

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
      const responseMs = Math.max(
        0,
        Math.round(((q.time ?? tweaks.questionTime) - Math.max(0, state.timer)) * 1000),
      );
      track(AnalyticsEvent.QuestionAnswerResult, questionAnalytics(q, {
        question_index: state.qIdx + 1,
        question_count: totalQs,
        is_correct: right,
        response_ms: responseMs,
        time_remaining_sec: Math.max(0, Math.round(state.timer)),
        score_after: state.score,
      }));

      // Record the answer for server-side re-scoring (tournament only). The
      // selection is normalized to an index array the server scorer understands;
      // timeout (-1) submits an empty selection (counts as wrong).
      const selection: number[] =
        state.qAnswered === -1
          ? []
          : q.kind === "multi" || q.kind === "order"
            ? (state.qSelection ?? [])
            : state.qAnswered != null && state.qAnswered >= 0
              ? [state.qAnswered]
              : [];
      const nextAnswers: RoundAnswer[] =
        state.mode === "tournament" && q.id
          ? [...state.roundAnswers, { id: q.id, selection, responseMs }]
          : state.roundAnswers;

      if (state.mode === "level") {
        // Per-question LEVEL stats — record this answer (server re-scores from
        // the selection). Fire-and-forget; captures every answered level
        // question, whether the level is ultimately completed or failed.
        if (q.id) void recordLevelPlay([{ id: q.id, selection, responseMs }]);
        // Shield absorbs one wrong answer instead of costing a heart.
        const shielded = wrong && state.shieldActive;
        const newHearts = wrong && !state.shieldActive ? state.hearts - 1 : state.hearts;
        if (newHearts <= 0) {
          track(AnalyticsEvent.LifeLost, {
            reason: "level_failed",
            lives_before: state.lives,
            lives_after: Math.max(0, state.lives - 1),
          });
          track(AnalyticsEvent.LevelFailed, {
            level_track: state.levelTrack,
            level_number: state.levelByTrack[state.levelTrack],
            score: state.score,
            question_count: totalQs,
            lives_remaining: Math.max(0, state.lives - 1),
          });
          // Failing a level costs a life; start the regen clock if we were full.
          const wasFull = state.lives >= LIVES_MAX;
          update({
            hearts: 0,
            lives: Math.max(0, state.lives - 1),
            nextLifeAt: wasFull ? Date.now() + LIFE_REGEN_MS : state.nextLifeAt,
          });
          void loseLife(); // persist the life loss (regen clock is server-side too)
          goto("levelFail");
          return;
        }
        if (state.qIdx + 1 >= totalQs) {
          const track = state.levelTrack;
          const newLevel = state.levelByTrack[track] + 1;
          // Curved free-ticket milestone — actually credited now (was previously
          // only promised in the UI). Advances only the active track.
          const milestoneTicket = isLevelTicketMilestone(newLevel) ? 1 : 0;
          trackClientEvent(AnalyticsEvent.LevelCompleted, {
            screen: state.screen,
            mode: "level",
            level_track: track,
            level_number: state.levelByTrack[track],
            score: state.score,
            question_count: totalQs,
            tickets_before: state.tickets,
            tickets_after: state.tickets + milestoneTicket,
            ticket_delta: milestoneTicket,
            xp_before: state.xp,
            xp_after: state.xp + state.score,
            xp_delta: state.score,
          });
          if (state.levelByTrack[track] === 1) {
            trackClientEvent(AnalyticsEvent.FirstLevelCompleted, {
              screen: state.screen,
              mode: "level",
              level_track: track,
              level_number: 1,
              score: state.score,
              question_count: totalQs,
              tickets_before: state.tickets,
              tickets_after: state.tickets + milestoneTicket,
              ticket_delta: milestoneTicket,
              xp_before: state.xp,
              xp_after: state.xp + state.score,
              xp_delta: state.score,
            });
          }
          trackClientEvent(AnalyticsEvent.LevelAdvanced, {
            screen: state.screen,
            mode: "level",
            level_track: track,
            level_number: newLevel,
            previous_level_number: state.levelByTrack[track],
            score: state.score,
            question_count: totalQs,
            tickets_before: state.tickets,
            tickets_after: state.tickets + milestoneTicket,
            ticket_delta: milestoneTicket,
            xp_before: state.xp,
            xp_after: state.xp + state.score,
            xp_delta: state.score,
          });
          update({ hearts: newHearts, levelByTrack: { ...state.levelByTrack, [track]: newLevel }, xp: state.xp + state.score, tickets: state.tickets + milestoneTicket, levelJustUnlocked: newLevel });
          // Persist: advanceLevel credits the same milestone ticket + xp server-side.
          void advanceLevel(track, state.score);
          // Daily mission accrual — a completed solo level counts as a played
          // game plus its answered questions / points toward event-keyed missions.
          void recordMissionEvent("games_played", 1);
          void recordMissionEvent("questions_answered", totalQs);
          void recordMissionEvent("points_scored", state.score);
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
        track(AnalyticsEvent.QuestionNextClicked, {
          mode: "level",
          question_index: state.qIdx + 1,
          next_question_index: state.qIdx + 2,
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
        const provisionalRank = tournamentRank(state.score, totalQs);
        if (state.tournamentGameId) {
          // On-chain tournament: score is recorded server-side against the
          // game's own questions (settlement + prize are fully server/chain).
          track(AnalyticsEvent.TournamentScoreSubmitted, {
            game_id: state.tournamentGameId,
            score: state.score,
            question_count: totalQs,
            answers_submitted: nextAnswers.length,
            xp_multiplier: xpMult,
          });
          void submitTournamentAnswers(state.tournamentGameId, nextAnswers);
        }
        // Local provisional placement shown on the results screen (the locked
        // rank/prize come later at settlement, server/chain-side).
        track(AnalyticsEvent.TournamentResultLocalSettled, {
          game_id: state.tournamentGameId,
          score: state.score,
          question_count: totalQs,
          provisional_rank: provisionalRank,
          on_chain: Boolean(state.tournamentGameId),
        });
        // Daily mission accrual — emit the gameplay events this tournament round
        // produced; the mission service advances whatever missions are keyed to
        // each event today (server-side).
        track(AnalyticsEvent.MissionProgressRecorded, {
          reason: "tournament_round_complete",
          question_count: totalQs,
          score: state.score,
        });
        void recordMissionEvent("questions_answered", totalQs);
        void recordMissionEvent("points_scored", state.score);
        void recordMissionEvent("tournaments_played", 1);
        goto("results");
        update((s) => ({
          xp: s.xp + s.score * xpMult,
          roundAnswers: nextAnswers,
        }));
      } else {
        update({
          roundAnswers: nextAnswers,
          qIdx: state.qIdx + 1,
          qAnswered: null,
          qSelection: null,
          eliminated: [],
          timer: state.roundQuestions[state.qIdx + 1]?.time ?? tweaks.questionTime,
        });
        track(AnalyticsEvent.QuestionNextClicked, {
          mode: "tournament",
          question_index: state.qIdx + 1,
          next_question_index: state.qIdx + 2,
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
    track(AnalyticsEvent.QuestionAnswerSubmitted, questionAnalytics(q, {
      mode: state.mode,
      question_index: state.qIdx + 1,
      question_count: state.roundQuestions.length,
      selected_option_hash: hashAnalyticsValue(answerIdx),
      time_remaining_sec: Math.max(0, Math.round(state.timer)),
      score_delta: delta,
      score_after: Math.max(0, state.score + delta),
    }));
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
    const delta = Math.round(base * accuracy);
    track(AnalyticsEvent.QuestionAnswerSubmitted, questionAnalytics(q, {
      mode: state.mode,
      question_index: state.qIdx + 1,
      question_count: state.roundQuestions.length,
      selected_count: indices.length,
      selected_option_hash: hashAnalyticsValue(indices.join(",")),
      time_remaining_sec: Math.max(0, Math.round(state.timer)),
      score_delta: delta,
      score_after: state.score + delta,
    }));
    update({
      qAnswered: -2,
      qSelection: indices,
      score: state.score + delta,
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
    const delta = Math.round(base * accuracy);
    track(AnalyticsEvent.QuestionAnswerSubmitted, questionAnalytics(q, {
      mode: state.mode,
      question_index: state.qIdx + 1,
      question_count: state.roundQuestions.length,
      selected_count: order.length,
      selected_option_hash: hashAnalyticsValue(order.join(",")),
      time_remaining_sec: Math.max(0, Math.round(state.timer)),
      score_delta: delta,
      score_after: state.score + delta,
    }));
    update({
      qAnswered: -3,
      qSelection: order,
      score: state.score + delta,
    });
  };

  const markResultRead = (id: string) => {
    update((s) => ({ resultNotifs: s.resultNotifs.map((r) => (r.id === id ? { ...r, read: true } : r)) }));
  };

  // Hide a banner announcement; persisted to the DB (AnnouncementState) for
  // authored items so it stays hidden cross-device. Triggered cards are
  // session-only (the server skips their persistence).
  const dismissAnnouncement = (id: string) => {
    track(AnalyticsEvent.AnnouncementDismissStarted, {
      ref_id_kind: "announcement",
      announcement_id_hash: hashAnalyticsValue(id),
    });
    void dismissAnnouncementAction(id).then(() => {
      trackClientEvent(AnalyticsEvent.AnnouncementDismissSucceeded, {
        screen: state.screen,
        ref_id_kind: "announcement",
        announcement_id_hash: hashAnalyticsValue(id),
      });
    });
    update((s) => {
      if (s.annDismissed.includes(id)) return {};
      return { annDismissed: [...s.annDismissed, id] };
    });
  };

  // Mark announcements read (clears the inbox unread dot); persisted to the DB
  // (AnnouncementState) for authored items.
  const markAnnouncementsRead = (ids: string[]) => {
    track(AnalyticsEvent.AnnouncementMarkReadStarted, {
      ref_id_kind: "announcement",
      count: ids.length,
    });
    void setAnnouncementsRead(ids).then(() => {
      trackClientEvent(AnalyticsEvent.AnnouncementMarkReadSucceeded, {
        screen: state.screen,
        ref_id_kind: "announcement",
        count: ids.length,
      });
    });
    update((s) => {
      const next = Array.from(new Set([...s.annRead, ...ids]));
      if (next.length === s.annRead.length) return {};
      return { annRead: next };
    });
  };

  // Both entry points gate on lives: at 0 we reconcile any regen and route to the
  // level path (where the refill / wait UI lives) instead of starting a run the
  // player can't afford to fail.
  const enterLevel = () => {
    const r = regenLives(state.lives, state.nextLifeAt, Date.now());
    if (r.lives <= 0) {
      track(AnalyticsEvent.LevelRetryClicked, {
        level_track: state.levelTrack,
        level_number: state.levelByTrack[state.levelTrack],
        reason: "no_lives",
      });
      update(r);
      goto("levels");
      return;
    }
    track(AnalyticsEvent.LevelStarted, {
      level_track: state.levelTrack,
      level_number: state.levelByTrack[state.levelTrack],
      lives: r.lives,
      question_count: tweaks.levelQuestions,
    });
    if (state.levelByTrack[state.levelTrack] === 1) {
      track(AnalyticsEvent.FirstLevelStarted, {
        level_track: state.levelTrack,
        level_number: 1,
        lives: r.lives,
        question_count: tweaks.levelQuestions,
      });
    }
    update({ ...r, mode: "level", qIdx: 0, score: 0, qAnswered: null, hearts: 3, timer: tweaks.questionTime, pendingLevelQuestions: null });
    goto("levelIntro");
    // Prefetch the level's questions from the server during the intro screen so
    // play starts instantly. Falls back to the local bank in beginLevelQuiz if
    // this hasn't resolved (or returned nothing).
    const lvTrack = state.levelTrack;
    const lvLevel = state.levelByTrack[lvTrack];
    void getLevelQuestions(lvTrack, lvLevel)
      .then((qs) => {
        if (!qs || qs.length === 0) return;
        const mapped: Question[] = qs.map((q) => ({ ...q }));
        update((s) =>
          s.levelTrack === lvTrack && s.levelByTrack[lvTrack] === lvLevel
            ? { pendingLevelQuestions: mapped }
            : {},
        );
      })
      .catch(() => {});
  };
  const startLevel = enterLevel;
  const retryLevel = enterLevel;

  const refillLives = () => {
    if (state.lives >= LIVES_MAX || state.tickets < LIVES_REFILL_COST) {
      track(AnalyticsEvent.LivesRefillBlocked, {
        reason: state.lives >= LIVES_MAX ? "lives_full" : "insufficient_tickets",
        tickets_balance: state.tickets,
        lives: state.lives,
      });
      return;
    }
    track(AnalyticsEvent.LivesRefillStarted, {
      tickets_before: state.tickets,
      lives: state.lives,
      ticket_delta: -LIVES_REFILL_COST,
    });
    void refillLivesAction().then((result) => {
      trackClientEvent(AnalyticsEvent.LivesRefillSucceeded, {
        screen: state.screen,
        tickets_after: result?.tickets ?? state.tickets - LIVES_REFILL_COST,
        lives: result?.lives ?? LIVES_MAX,
        ticket_delta: -LIVES_REFILL_COST,
      });
    });
    update((s) => {
      if (s.lives >= LIVES_MAX || s.tickets < LIVES_REFILL_COST) return {};
      return { tickets: s.tickets - LIVES_REFILL_COST, lives: LIVES_MAX, nextLifeAt: null };
    });
  };

  const beginLevelQuiz = async () => {
    // Server-authoritative questions only — never mock content. Use the set
    // prefetched on the intro; if it didn't land, fetch it now. If it still
    // can't be loaded, bail back to the level path with a notice rather than
    // start the level on fake questions.
    let rq = state.pendingLevelQuestions;
    if (!rq || rq.length === 0) {
      update({ levelLoading: true });
      const lvTrack = state.levelTrack;
      const lvLevel = state.levelByTrack[lvTrack];
      try {
        const qs = await getLevelQuestions(lvTrack, lvLevel);
        rq = qs && qs.length ? qs.map((q) => ({ ...q })) : null;
      } catch {
        rq = null;
      }
      update({ levelLoading: false });
    }
    if (!rq || rq.length === 0) {
      update({ toast: "Couldn’t load this level — please try again." });
      goto("levels");
      return;
    }
    const questions = rq;
    update({
      qIdx: 0,
      score: 0,
      qAnswered: null,
      eliminated: [],
      shieldActive: false,
      timer: questions[0]?.time ?? tweaks.questionTime,
      roundQuestions: questions,
      pendingLevelQuestions: null,
    });
    goto("question");
  };

  // Activate a shop power-up in the live quiz (consumes one from inventory).
  const usePowerUp = (kind: PowerUpName) => {
    // Power-ups are a solo-level perk only — the on-chain tournament stays
    // pure-skill (no ticket-bought advantage in the real-money round).
    if (state.mode !== "level") return;
    track(AnalyticsEvent.PowerupUseStarted, {
      powerup_id: kind,
      question_index: state.qIdx + 1,
      inventory_before: null,
    });
    void consumePowerUp(kind)
      .then((result) => {
        trackClientEvent(AnalyticsEvent.PowerupUseSucceeded, {
          screen: state.screen,
          mode: state.mode,
          powerup_id: kind,
          inventory_after: result?.remaining ?? null,
        });
      })
      .catch((error) => {
        trackClientEvent(AnalyticsEvent.PowerupUseFailed, {
          screen: state.screen,
          mode: state.mode,
          powerup_id: kind,
          reason: error instanceof Error ? error.message : "consume_failed",
        });
      });
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
      roundQuestions: [], // server-issued on tournament entry; never seeded locally
      tournamentBonus: false,
      tournamentGameId: null,
    });
    goto("home");
  };

  const setLevelTrack = (nextTrack: LevelTrack) => {
    track(AnalyticsEvent.LevelTrackChanged, {
      previous_level_track: state.levelTrack,
      level_track: nextTrack,
      level_number: state.levelByTrack[nextTrack],
    });
    update({ levelTrack: nextTrack });
  };

  // Persist + apply the player's chosen username.
  const setUsername = (name: string) => {
    const clean = name.trim();
    track(AnalyticsEvent.UsernameSetStarted, {
      username_length: clean.length,
    });
    writeUsername(clean);
    void setUsernameAction(clean)
      .then(() => {
        trackClientEvent(AnalyticsEvent.UsernameSetSucceeded, {
          screen: state.screen,
          username_length: clean.length,
        });
      })
      .catch((error) => {
        trackClientEvent(AnalyticsEvent.UsernameSetFailed, {
          screen: state.screen,
          username_length: clean.length,
          reason: error instanceof Error ? error.message : "username_failed",
        });
      });
    update({ username: clean });
  };

  // ── On-chain tournament (a round IS a v1 Game: real USDC entry → pool → claim) ──
  // Enter the current on-chain tournament: deposit via wallet `buyTicket`, then
  // record the verified entry server-side and start the round on the server's
  // authoritative questions. Reuses v1's contract layer end-to-end.
  const enterTournamentOnChain = async (): Promise<{ ok: boolean; error?: string }> => {
    const t = await getTournament();
    if (!t || !t.game.onchainId) {
      blog("[buy-ticket] no tournament / not on-chain", { hasTournament: !!t, onchainId: t?.game.onchainId });
      track(AnalyticsEvent.TournamentEntryBlocked, { reason: "no_tournament" });
      return { ok: false, error: "no_tournament" };
    }
    blog("[buy-ticket] enter flow start", {
      gameId: t.game.id, gameNumber: t.game.gameNumber, platform: t.game.platform,
      onchainId: t.game.onchainId, entryFee: t.game.entryFee,
    });
    // Shared context stamped on every step of the funnel so the on-chain entry
    // (start → approve → pay → confirm → server sync) is one analyzable journey.
    const entryContext = {
      game_id: t.game.id,
      game_number: t.game.gameNumber,
      entry_fee: t.game.entryFee,
      platform: t.game.platform,
      onchain_id: t.game.onchainId,
    };
    track(AnalyticsEvent.TournamentEntryStarted, entryContext);
    track(AnalyticsEvent.TicketPurchaseStarted, entryContext);
    // The wallet hook reports flow steps via `onStep`; map the ones that mark a
    // real on-chain milestone to funnel events. `sawApproving` distinguishes the
    // approve→confirmed transition (only fires when an approval was actually
    // needed — a standing allowance skips straight to paying).
    let sawApproving = false;
    const onStep = (step: TournamentTxStep) => {
      update({ tournamentStep: step });
      switch (step) {
        case "switching":
          track(AnalyticsEvent.WalletChainSwitchStarted, entryContext);
          break;
        case "approving":
          sawApproving = true;
          track(AnalyticsEvent.TicketApprovalSubmitted, entryContext);
          break;
        case "paying":
          if (sawApproving) track(AnalyticsEvent.TicketApprovalConfirmed, entryContext);
          break;
        case "confirming":
          track(AnalyticsEvent.TicketPurchaseTxSubmitted, entryContext);
          break;
      }
    };
    try {
      const txHash = await tournamentWallet.enter(
        assertChainPlatform(t.game.platform),
        t.game.onchainId as `0x${string}`,
        t.game.entryFee,
        onStep,
      );
      track(AnalyticsEvent.TicketPurchaseTxConfirmed, entryContext);
      blog("[buy-ticket] on-chain done, verifying server-side", { txHash });
      update({ tournamentStep: "verifying" });
      track(AnalyticsEvent.TicketPurchaseSyncStarted, entryContext);
      const res = await enterTournament(t.game.id, txHash);
      if (!res || !res.ok) {
        blog("[buy-ticket] server verify rejected", { res });
        update({ tournamentStep: null });
        const reason = res && !res.ok ? res.error : "entry_failed";
        track(AnalyticsEvent.TicketPurchaseSyncFailed, { ...entryContext, reason });
        track(AnalyticsEvent.TicketPurchaseFailed, { ...entryContext, stage: "server_sync", reason });
        return { ok: false, error: reason };
      }
      // Revenue is attached to exactly ONE success event (not both, to avoid
      // double-counting in Umami's revenue report). `revenue`+`currency` are the
      // keys Umami reads natively; entry fee is USDC, valued ~1:1 in USD.
      track(AnalyticsEvent.TicketPurchaseSyncSucceeded, { ...entryContext, revenue: t.game.entryFee, currency: "USD" });
      track(AnalyticsEvent.TournamentEntrySucceeded, entryContext);
      track(AnalyticsEvent.TournamentLobbyEntered, entryContext);
      blog("[buy-ticket] entry confirmed ✓ — entering lobby", { gameId: t.game.id });
      const mapped: Question[] = t.questions.map((q) => ({ ...q }));
      update({
        mode: "tournament",
        tournamentGameId: t.game.id,
        roundQuestions: mapped,
        roundAnswers: [],
        qIdx: 0,
        score: 0,
        qAnswered: null,
        hearts: 3,
        timer: mapped[0]?.time ?? tweaks.questionTime,
        countdownSec: tweaks.lobbyCountdown,
        tournamentStep: null,
      });
      goto("lobby");
      return { ok: true };
    } catch (e) {
      blog("[buy-ticket] enter flow threw", e);
      update({ tournamentStep: null });
      const message = e instanceof Error ? e.message : "wallet_error";
      track(AnalyticsEvent.TicketPurchaseFailed, {
        ...entryContext,
        stage: "wallet",
        reason: classifyWalletError(message),
      });
      return { ok: false, error: message };
    }
  };

  // Resume an entry the player ALREADY paid for — drop into the round without a
  // second on-chain charge. For entered-but-not-yet-played users (the post-purchase
  // auto-route didn't fire, or they chose to play later). Gameplay integrity is
  // preserved by gating the CTA on `board.you.played === false`; the round must
  // also still be live (submit is a no-op past endsAt) and the server keeps the
  // best score, so this can never lower an existing result.
  const playEnteredTournament = async (): Promise<{ ok: boolean; error?: string }> => {
    const t = await getTournament();
    if (!t || !t.game.onchainId) {
      track(AnalyticsEvent.TournamentEntryBlocked, { reason: "no_tournament" });
      return { ok: false, error: "no_tournament" };
    }
    track(AnalyticsEvent.TournamentLobbyEntered, {
      game_id: t.game.id,
      game_number: t.game.gameNumber,
      platform: t.game.platform,
      resumed: true,
    });
    const mapped: Question[] = t.questions.map((q) => ({ ...q }));
    update({
      mode: "tournament",
      tournamentGameId: t.game.id,
      roundQuestions: mapped,
      roundAnswers: [],
      qIdx: 0,
      score: 0,
      qAnswered: null,
      hearts: 3,
      timer: mapped[0]?.time ?? tweaks.questionTime,
      countdownSec: tweaks.lobbyCountdown,
      tournamentStep: null,
    });
    goto("lobby");
    return { ok: true };
  };

  // Claim a settled on-chain prize: send `claimPrize` with the merkle proof, then
  // confirm server-side (reused `verifyClaim`).
  const claimTournamentPrize = async (gameId: string): Promise<{ ok: boolean; error?: string }> => {
    track(AnalyticsEvent.PrizeClaimStarted, { game_id: gameId });
    const claim = await getTournamentClaim(gameId);
    if (!claim) {
      track(AnalyticsEvent.PrizeResolutionFailed, { game_id: gameId, reason: "nothing_to_claim" });
      return { ok: false, error: "nothing_to_claim" };
    }
    const claimContext = {
      game_id: gameId,
      platform: claim.platform,
      onchain_id: claim.onchainId,
      prize_amount: claim.amount,
    };
    // Self-heal first: if the prize is already claimed on-chain (a prior confirm
    // desynced from a successful claim), settle it in the DB without sending a
    // tx that would just revert with "already claimed".
    const pre = await reconcileTournamentClaim(gameId);
    if (pre?.reconciled) {
      track(AnalyticsEvent.PrizeResolutionSucceeded, { ...claimContext, via: "reconcile_pre" });
      return { ok: true };
    }
    track(AnalyticsEvent.PrizeResolutionStarted, claimContext);
    try {
      const txHash = await tournamentWallet.claim(
        assertChainPlatform(claim.platform),
        claim.onchainId,
        BigInt(claim.amount),
        claim.proof,
        (step) => update({ tournamentStep: step }),
      );
      update({ tournamentStep: "verifying" });
      const res = await confirmTournamentClaim(gameId, txHash);
      update({ tournamentStep: null });
      if (!res || !res.ok) {
        const reason = res && !res.ok ? res.error : "claim_failed";
        track(AnalyticsEvent.PrizeResolutionFailed, { ...claimContext, stage: "server_confirm", reason });
        return { ok: false, error: reason };
      }
      track(AnalyticsEvent.PrizeResolutionSucceeded, { ...claimContext, via: "claim" });
      return { ok: true };
    } catch (e) {
      update({ tournamentStep: null });
      // The wallet tx may have reverted because it was already claimed on-chain
      // — reconcile as a last resort so the prize isn't stuck "claimable".
      const recon = await reconcileTournamentClaim(gameId);
      if (recon?.reconciled) {
        track(AnalyticsEvent.PrizeResolutionSucceeded, { ...claimContext, via: "reconcile_post" });
        return { ok: true };
      }
      const message = e instanceof Error ? e.message : "wallet_error";
      track(AnalyticsEvent.PrizeResolutionFailed, {
        ...claimContext,
        stage: "wallet",
        reason: classifyWalletError(message),
      });
      return { ok: false, error: message };
    }
  };

  const value: Proto = {
    ...state,
    tweaks,
    currentQuestion: state.roundQuestions[state.qIdx] ?? state.roundQuestions[0] ?? EMPTY_QUESTION,
    totalQuestions: state.roundQuestions.length,
    level: state.levelByTrack[state.levelTrack],
    setLevelTrack,
    goto,
    update,
    answerQuestion,
    answerMulti,
    answerOrder,
    markResultRead,
    dismissAnnouncement,
    markAnnouncementsRead,
    setUsername,
    startLevel,
    beginLevelQuiz,
    retryLevel,
    refillLives,
    playAgain,
    usePowerUp,
    enterTournamentOnChain,
    playEnteredTournament,
    claimTournamentPrize,
  };

  return <ProtoContext.Provider value={value}>{children}</ProtoContext.Provider>;
}

export function useProto(): Proto {
  const ctx = useContext(ProtoContext);
  if (!ctx) throw new Error("useProto must be used inside <ProtoProvider>");
  return ctx;
}
