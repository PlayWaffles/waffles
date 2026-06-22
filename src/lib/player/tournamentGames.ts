/**
 * v2 tournament rounds, ON-CHAIN — a tournament round IS a v1 `Game`.
 *
 * Instead of the off-chain `RoundEntry` ledger, the hourly tournament reuses the
 * existing v1 money lifecycle end-to-end:
 *   - schedule + create on-chain  → `createAutoScheduledGame` → `createGameOnChain`
 *   - entry (real USDC deposit)   → `verifyTicketPurchase` → `GameEntry`
 *   - play + score                → server-authoritative scoring (this file)
 *   - settle (merkle on-chain)    → `rankGame` + `publishResults` (lifecycle.ts)
 *   - claim (pull from pool)      → the v1 claim route + `verifyClaim`
 *
 * The pool is funded by the players' on-chain entries (exactly like v1) — no
 * treasury funding, no new contract. This file only adds the thin bridge:
 * exposing the current game, recording verified entries, and scoring answers
 * against the game's own authoritative questions.
 */
import { parseUnits } from "viem";
import { prisma } from "@/lib/db";
import { Prisma, QuestionKind, TicketLedgerReason, TicketPurchaseSource, type UserPlatform } from "@prisma";
import { accrueLeaguePoints } from "./leagues";
import { adjustTickets } from "./playerState";
import { recordQuestionStats } from "./questionStats";
import { displayCategory, shuffleQuestionOptions } from "./roundQuestions";
import { PAYMENT_TOKEN_DECIMALS } from "@/lib/chain";
import { isPrizeClaimedOnChain, verifyClaim, verifyTicketPurchase } from "@/lib/chain/verify";
import { calculatePrizePoolContribution } from "@/lib/admin-utils";
import { createAutoScheduledGame } from "@/lib/game/auto-create";
import { trackServerEvent } from "@/lib/server-analytics";
import {
  scoreAnswer,
  scoreRound,
  type RoundAnswer,
  type ScorableKind,
  type ScorableQuestion,
} from "./scoring";

const KIND_MAP: Record<QuestionKind, ScorableKind> = {
  [QuestionKind.SINGLE]: "single",
  [QuestionKind.MULTI]: "multi",
  [QuestionKind.ORDER]: "order",
  [QuestionKind.SPATIAL]: "spatial",
};

const GAME_QUESTION_SELECT = {
  id: true,
  templateId: true,
  orderInRound: true,
  roundIndex: true,
  content: true,
  options: true,
  correctIndex: true,
  kind: true,
  correctSet: true,
  pick: true,
  correctOrder: true,
  flags: true,
  minefield: true,
  kicker: true,
  clues: true,
  category: true,
  durationSec: true,
  mediaUrl: true,
} as const;

type GameQuestionRow = Prisma.QuestionGetPayload<{ select: typeof GAME_QUESTION_SELECT }>;

const toScorable = (q: GameQuestionRow): ScorableQuestion => ({
  id: q.id,
  kind: KIND_MAP[q.kind],
  correct: q.correctIndex,
  correctSet: q.correctSet,
  pick: q.pick,
  correctOrder: q.correctOrder,
  minefield: q.minefield,
  durationSec: q.durationSec,
});

async function gameQuestions(gameId: string): Promise<GameQuestionRow[]> {
  const rows = await prisma.question.findMany({
    where: { gameId },
    orderBy: [{ roundIndex: "asc" }, { orderInRound: "asc" }],
    select: GAME_QUESTION_SELECT,
  });
  // Shuffle each question's options (deterministically, by question id) so the
  // correct answer isn't pinned to one slot. Applied here — the single seam both
  // the client read (getTournamentClientQuestions) and the server re-score
  // (submitTournamentAnswers) flow through — so the rendered order and the
  // scored order can never drift apart.
  return rows.map(shuffleQuestionOptions);
}

// ---------------------------------------------------------------------------
// Hourly scheduling — the v1 auto-scheduler is Mon/Wed/Fri day-long games, NOT
// hourly, so tournaments get their own hourly cadence (still reusing v1's game
// creation: questions assigned + created on-chain).
// ---------------------------------------------------------------------------

export const TOURNAMENT_ROUND_MS = 60 * 60 * 1000; // hourly
const TICKETS_LEAD_MS = 5 * 60 * 1000; // sales open 5m before the hour
export const TOURNAMENT_MAX_PLAYERS = 50;

// Entry pricing. The contract requires the entry payment to EXACTLY equal the
// game's on-chain price, so there is ONE flat price for everyone — the game
// floor. STANDARD_FEE is display-only: the UI shows it struck through above the
// real price so entry always reads as a discount ("$0.10 → $0.05"), but nobody
// is ever charged it. (Per-user pricing is impossible here — one game, one price.)
export const TOURNAMENT_ENTRY_FEE_USDC = 0.05; // the real, flat on-chain price
export const TOURNAMENT_STANDARD_FEE_USDC = 0.1; // display-only "was" price (struck through)
const DEFAULT_ENTRY_FEE_USDC = TOURNAMENT_ENTRY_FEE_USDC; // game floor = the flat price

/**
 * Ensure the platform's current hour has a live tournament `Game`, creating one
 * (on-chain, with questions) if not. Idempotent — a no-op when a game already
 * covers `now`. Intended to be driven by an hourly cron.
 */
export async function ensureHourlyTournamentGame(
  platform: UserPlatform,
): Promise<{ created: boolean; gameId: string }> {
  const now = Date.now();

  const live = await prisma.game.findFirst({
    where: { platform, startsAt: { lte: new Date(now) }, endsAt: { gt: new Date(now) } },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });
  if (live) return { created: false, gameId: live.id };

  // Align to the current hour boundary so every entrant shares one window.
  const startsAt = new Date(Math.floor(now / TOURNAMENT_ROUND_MS) * TOURNAMENT_ROUND_MS);
  const endsAt = new Date(startsAt.getTime() + TOURNAMENT_ROUND_MS);

  // Inherit non-cap play params from the platform's most recent game.
  const recent = await prisma.game.findFirst({
    where: { platform },
    orderBy: { startsAt: "desc" },
    select: { roundBreakSec: true },
  });

  const created = await createAutoScheduledGame({
    platform,
    startsAt,
    endsAt,
    ticketsOpenAt: new Date(startsAt.getTime() - TICKETS_LEAD_MS),
    // On-chain min = the discounted floor so first-timers can pay it; the
    // standard fee is enforced per-user server-side, not by the contract.
    ticketPrice: DEFAULT_ENTRY_FEE_USDC,
    roundBreakSec: recent?.roundBreakSec ?? 0,
    maxPlayers: TOURNAMENT_MAX_PLAYERS,
  });
  return { created: true, gameId: created.gameId };
}

// ---------------------------------------------------------------------------
// Current tournament round (a live/upcoming on-chain Game)
// ---------------------------------------------------------------------------

export type TournamentParticipantAvatar = {
  userId: string;
  name: string;
  avatarId: string | null;
  pfpUrl: string | null;
};

export type TournamentGame = {
  id: string;
  onchainId: string | null;
  gameNumber: number;
  platform: UserPlatform;
  title: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  ticketsOpenAt: Date | null;
  entryFee: number;
  prizePool: number;
  playerCount: number;
  maxPlayers: number;
  todayEntryCount: number;
  todayPlayerCount: number;
  todayPrizePool: number;
  recentEntryCount: number;
  participantAvatars: TournamentParticipantAvatar[];
};

async function participantAvatarsForGame(
  gameId: string,
  platform: UserPlatform,
  now: Date,
  limit = 6,
): Promise<TournamentParticipantAvatar[]> {
  const currentEntries = await prisma.gameEntry.findMany({
    where: { gameId, paidAt: { not: null } },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: {
      userId: true,
      user: { select: { username: true, avatarId: true, pfpUrl: true } },
    },
  });

  const seen = new Set<string>();
  const avatars: TournamentParticipantAvatar[] = [];
  for (const entry of currentEntries) {
    seen.add(entry.userId);
    avatars.push({
      userId: entry.userId,
      name: entry.user.username ?? "Player",
      avatarId: entry.user.avatarId ?? null,
      pfpUrl: entry.user.pfpUrl ?? null,
    });
  }

  if (avatars.length >= limit) return avatars;

  const lastGame = await prisma.game.findFirst({
    where: {
      platform,
      id: { not: gameId },
      onchainId: { not: null },
      endsAt: { lte: now },
      entries: { some: { paidAt: { not: null } } },
    },
    orderBy: { endsAt: "desc" },
    select: { id: true },
  });
  if (!lastGame) return avatars;

  const previousEntries = await prisma.gameEntry.findMany({
    where: {
      gameId: lastGame.id,
      paidAt: { not: null },
      userId: seen.size > 0 ? { notIn: [...seen] } : undefined,
    },
    orderBy: { paidAt: "desc" },
    take: limit - avatars.length,
    select: {
      userId: true,
      user: { select: { username: true, avatarId: true, pfpUrl: true } },
    },
  });

  for (const entry of previousEntries) {
    avatars.push({
      userId: entry.userId,
      name: entry.user.username ?? "Player",
      avatarId: entry.user.avatarId ?? null,
      pfpUrl: entry.user.pfpUrl ?? null,
    });
  }

  return avatars;
}

/** The platform's current tournament round — the soonest game that hasn't ended.
 *  Scheduling/creation is handled by the existing v1 auto-scheduler; here we
 *  only read it. */
export async function currentTournamentGame(
  platform: UserPlatform,
): Promise<TournamentGame | null> {
  const now = new Date();
  const game = await prisma.game.findFirst({
    where: { platform, endsAt: { gt: now }, onchainId: { not: null } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      onchainId: true,
      gameNumber: true,
      platform: true,
      title: true,
      theme: true,
      startsAt: true,
      endsAt: true,
      ticketsOpenAt: true,
      tierPrices: true,
      prizePool: true,
      playerCount: true,
      maxPlayers: true,
    },
  });
  if (!game) return null;

  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const recentStart = new Date(now.getTime() - 15 * 60 * 1000);

  const [todayEntries, todayPrizePool, recentEntryCount, participantAvatars] = await Promise.all([
    prisma.gameEntry.findMany({
      where: {
        paidAt: { not: null },
        game: {
          platform,
          onchainId: { not: null },
          startsAt: { gte: todayStart, lt: todayEnd },
        },
      },
      select: { userId: true },
    }),
    prisma.game.aggregate({
      where: {
        platform,
        onchainId: { not: null },
        startsAt: { gte: todayStart, lt: todayEnd },
      },
      _sum: { prizePool: true },
    }),
    prisma.gameEntry.count({
      where: {
        paidAt: { gte: recentStart },
        game: {
          platform,
          onchainId: { not: null },
          startsAt: { gte: todayStart, lt: todayEnd },
        },
      },
    }),
    participantAvatarsForGame(game.id, platform, now, 6),
  ]);

  return {
    id: game.id,
    onchainId: game.onchainId,
    gameNumber: game.gameNumber,
    platform: game.platform,
    title: game.title,
    theme: game.theme,
    startsAt: game.startsAt,
    endsAt: game.endsAt,
    ticketsOpenAt: game.ticketsOpenAt,
    entryFee: game.tierPrices[0] ?? 0,
    prizePool: game.prizePool,
    playerCount: game.playerCount,
    maxPlayers: game.maxPlayers,
    todayEntryCount: todayEntries.length,
    todayPlayerCount: new Set(todayEntries.map((entry) => entry.userId)).size,
    todayPrizePool: todayPrizePool._sum.prizePool ?? 0,
    recentEntryCount,
    participantAvatars,
  };
}

/** Whether this is the player's very first tournament — no prior tournament
 *  GameEntry on record. Drives the personalized entry upsell (first-timer
 *  welcome vs the evergreen World Cup framing). The current round isn't entered
 *  yet at upsell time, so a zero count means a genuine first-timer.
 *
 *  Scoped to tournament games only: v2 tournaments run a 1-hour window, v1
 *  games are day-long, and there's no discriminator column — so a migrated v1
 *  player (who has v1 entries but no tournament entry) still gets the
 *  first-timer welcome on their first v2 tournament. */
export async function isFirstTournamentEntry(userId: string): Promise<boolean> {
  // Comfortably above the 1h tournament window, well below a day-long v1 game.
  const MAX_TOURNAMENT_MS = 2 * TOURNAMENT_ROUND_MS;
  const rows = await prisma.gameEntry.findMany({
    where: { userId },
    select: { game: { select: { startsAt: true, endsAt: true } } },
  });
  const priorTournamentEntries = rows.filter(
    (r) => r.game.endsAt.getTime() - r.game.startsAt.getTime() <= MAX_TOURNAMENT_MS,
  ).length;
  return priorTournamentEntries === 0;
}

/** The round's questions in client shape (answer keys included for instant
 *  feedback), drawn from the game's own assigned questions. */
export async function getTournamentClientQuestions(gameId: string) {
  const [rows, game] = await Promise.all([
    gameQuestions(gameId),
    prisma.game.findUnique({ where: { id: gameId }, select: { theme: true } }),
  ]);
  const theme = game?.theme ?? "GENERAL";
  return rows.map((q) => ({
    id: q.id,
    // The subject (topic) — not the format. Format stays in `kicker`.
    cat: displayCategory(q.category, theme),
    q: q.content,
    answers: q.options,
    correct: q.correctIndex,
    kind: KIND_MAP[q.kind],
    correctSet: q.correctSet.length ? q.correctSet : undefined,
    pick: q.pick ?? undefined,
    correctOrder: q.correctOrder.length ? q.correctOrder : undefined,
    flags: q.flags.length ? q.flags : undefined,
    kicker: q.kicker ?? undefined,
    clues: q.clues.length ? q.clues : undefined,
    image: q.mediaUrl ?? undefined,
    time: q.durationSec,
    minefield: q.minefield || undefined,
  }));
}

// ---------------------------------------------------------------------------
// Entry — verify the on-chain deposit, record a GameEntry (reuses v1 verify)
// ---------------------------------------------------------------------------

export type EnterResult =
  | { ok: true; entryId: string; alreadyEntered: boolean }
  | { ok: false; error: string; retryable?: boolean };

export type TournamentEntrySource = "home" | "post_first_level_upsell" | "unknown";

/**
 * Record a tournament entry after verifying the player's on-chain `buyTicket`.
 * The deposit funds the on-chain prize pool (v1 model). Idempotent: one entry
 * per (game, user); the unique `txHash` also blocks replaying a payment.
 */
export async function enterTournamentOnChain(input: {
  userId: string;
  gameId: string;
  txHash: string;
  wallet: string;
  entrySource?: TournamentEntrySource;
}): Promise<EnterResult> {
  const { userId, gameId, txHash, wallet, entrySource = "unknown" } = input;
  console.log("[buy-ticket] server verify start", { userId, gameId, txHash, wallet });
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, onchainId: true, platform: true, network: true, tierPrices: true, endsAt: true },
  });
  if (!game?.onchainId) {
    console.warn("[buy-ticket] reject: game_not_onchain", { gameId, hasGame: !!game });
    return { ok: false, error: "game_not_onchain" };
  }
  if (new Date() >= game.endsAt) {
    console.warn("[buy-ticket] reject: game_ended", { gameId, endsAt: game.endsAt.toISOString() });
    return { ok: false, error: "game_ended" };
  }

  const existing = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { id: true },
  });
  if (existing) {
    console.log("[buy-ticket] already entered (short-circuit)", { gameId, userId, entryId: existing.id });
    return { ok: true, entryId: existing.id, alreadyEntered: true };
  }

  // Flat price = the game's on-chain floor. The contract enforces the exact
  // amount, so verify the deposit against that floor (never a client value).
  const entryFee = game.tierPrices[0] ?? DEFAULT_ENTRY_FEE_USDC;
  console.log("[buy-ticket] verifying on-chain", {
    gameId, platform: game.platform, network: game.network,
    onchainId: game.onchainId, expectedBuyer: wallet, entryFee, txHash,
  });
  const verification = await verifyTicketPurchase({
    platform: game.platform,
    network: game.network,
    txHash: txHash as `0x${string}`,
    expectedGameId: game.onchainId as `0x${string}`,
    expectedBuyer: wallet as `0x${string}`,
    minimumAmount: parseUnits(entryFee.toString(), PAYMENT_TOKEN_DECIMALS),
  });
  if (!verification.verified) {
    console.warn("[buy-ticket] verification FAILED", {
      gameId, userId, txHash, error: verification.error, retryable: verification.retryable,
    });
    return { ok: false, error: verification.error ?? "verification_failed", retryable: verification.retryable };
  }
  console.log("[buy-ticket] verified ✓ — recording entry", { gameId, userId, entryFee });
  const prizePoolContribution = calculatePrizePoolContribution(entryFee);

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.gameEntry.create({
        data: {
          gameId,
          userId,
          txHash,
          payerWallet: wallet,
          paidAmount: entryFee,
          paidAt: new Date(),
          purchaseSource: TicketPurchaseSource.PAID,
        },
        select: { id: true },
      });
      // Denormalized pool + headcount, mirroring v1's on-entry bookkeeping.
      await tx.game.update({
        where: { id: gameId },
        data: { prizePool: { increment: prizePoolContribution }, playerCount: { increment: 1 } },
      });
      // Authoritative, DB-backed purchase event — emitted in the same tx as the
      // entry write so it can't drift from reality (and rolls back with it).
      // Only fires on a *new* entry, never the already-entered short-circuits,
      // so revenue isn't double-counted. `revenue` mirrors the client's Umami
      // figure (entry fee is USDC, ~1:1 USD) for browser-vs-DB reconciliation.
      await trackServerEvent({
        name: "ticket_purchase_authoritative",
        userId,
        tx,
        properties: {
          game_id: gameId,
          onchain_id: game.onchainId,
          platform: game.platform,
          revenue: entryFee,
          currency: "USD",
          entry_fee: entryFee,
          entry_source: entrySource,
        },
      });
      return created;
    });
    console.log("[buy-ticket] entry recorded ✓", { gameId, userId, entryId: entry.id });
    return { ok: true, entryId: entry.id, alreadyEntered: false };
  } catch (error) {
    // Unique violation on (gameId,userId) or txHash → treat as already recorded.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingNow = await prisma.gameEntry.findUnique({
        where: { gameId_userId: { gameId, userId } },
        select: { id: true },
      });
      if (existingNow) {
        console.log("[buy-ticket] entry race (P2002) — already recorded", { gameId, userId, entryId: existingNow.id });
        return { ok: true, entryId: existingNow.id, alreadyEntered: true };
      }
    }
    console.error("[buy-ticket] entry write FAILED", { gameId, userId, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Scoring — server-authoritative, against the game's own questions
// ---------------------------------------------------------------------------

/**
 * Score a tournament round from submitted answers and record the SERVER-computed
 * score on the player's `GameEntry`. The client never posts a score; the server
 * re-scores against the game's authoritative questions (same anti-cheat caps as
 * `scoreRound`). Only touches the entry while the game is live, never lowers it.
 */
export async function submitTournamentAnswers(
  userId: string,
  gameId: string,
  answers: RoundAnswer[],
): Promise<{ score: number; updated: boolean } | null> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, endsAt: true },
  });
  if (!game) return null;
  if (new Date() >= game.endsAt) return { score: 0, updated: false };

  const rows = await gameQuestions(gameId);
  const issued = rows.map(toScorable);
  const score = scoreRound(issued, answers);

  // Per-question breakdown in the GameEntry.answers JSON shape v1 uses.
  const byId = new Map(issued.map((q) => [q.id, q]));
  const answersJson: Record<string, { selected: number | null; correct: boolean; points: number; ms: number }> = {};
  for (const a of answers ?? []) {
    const q = byId.get(a.id);
    if (!q) continue;
    const points = scoreAnswer(q, a);
    answersJson[a.id] = {
      selected: a.selection.length ? a.selection[0] : null,
      correct: points > 0,
      points,
      ms: a.responseMs,
    };
  }

  // Prior best score for this entry, so league points accrue only the
  // improvement (the tournament keeps the best of repeated submissions).
  const prev = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: { score: true, answered: true },
  });

  const result = await prisma.gameEntry.updateMany({
    where: {
      gameId,
      userId,
      OR: [{ score: { lt: score } }, { answered: { lt: Object.keys(answersJson).length } }],
    },
    data: { score, answered: Object.keys(answersJson).length, answers: answersJson },
  });

  if (result.count > 0) {
    const gained = Math.max(0, score - (prev?.score ?? 0));
    await accrueLeaguePoints(userId, gained);
    // Base Syrup for PLAYING — an extra reward on top of any cash prize, so even
    // non-winners walk away with something. Granted once, on the first completed
    // round only (prev.answered === 0), so a re-submit can't farm it. Winners
    // get an additional boost at settlement (rankGame). Keep this formula in sync
    // with tournamentSyrupReward() in player/state.tsx (the client display).
    if ((prev?.answered ?? 0) === 0) {
      const syrup = 10 + Math.round(Math.max(0, score) / 100);
      try {
        await adjustTickets(userId, syrup, TicketLedgerReason.TOURNAMENT_REWARD, { refId: gameId, note: "tournament play reward" });
      } catch (e) {
        console.error("[tournament] base syrup grant failed:", e);
      }
      // Per-question play stats (tournament mode) — once per completed round.
      const idToTemplate = new Map(rows.map((r) => [r.id, r.templateId]));
      const statItems = (answers ?? []).flatMap((a) => {
        const templateId = idToTemplate.get(a.id);
        const aj = answersJson[a.id];
        return templateId && aj ? [{ templateId, correct: aj.correct, responseMs: a.responseMs }] : [];
      });
      void recordQuestionStats("tournament", statItems);
    }
  }

  return { score, updated: result.count > 0 };
}

// ---------------------------------------------------------------------------
// Standings — leaderboard/results read from the DB (GameEntry), NOT the chain.
// The chain only holds the merkle root for payout; ranks/scores are DB.
// ---------------------------------------------------------------------------

export type TournamentStanding = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  /** Prize won in payment-token units (set at settlement); 0 if none. */
  prize: number;
  you: boolean;
  /** Whether this entrant has completed a round submission (answered > 0). Used
   *  to decide if an entered player can still "Play" (resume) vs only view standing. */
  played: boolean;
};

export type TournamentBoard = {
  gameId: string | null;
  fieldSize: number;
  standings: TournamentStanding[];
  you: TournamentStanding | null;
  settled: boolean;
};

const EMPTY_BOARD: TournamentBoard = { gameId: null, fieldSize: 0, standings: [], you: null, settled: false };

/** Standings for a tournament game from the DB — ranked by score (final `rank`
 *  once settled), with the field size and the caller's own row. */
export async function tournamentStandings(
  gameId: string | null,
  opts: { userId?: string; limit?: number } = {},
): Promise<TournamentBoard> {
  if (!gameId) return EMPTY_BOARD;
  const [game, entries] = await Promise.all([
    prisma.game.findUnique({ where: { id: gameId }, select: { rankedAt: true } }),
    prisma.gameEntry.findMany({
      where: { gameId, paidAt: { not: null } },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
      select: { userId: true, score: true, answered: true, rank: true, prize: true, user: { select: { username: true } } },
    }),
  ]);
  if (!game) return EMPTY_BOARD;

  const ranked: TournamentStanding[] = entries.map((e, i) => ({
    rank: e.rank ?? i + 1,
    userId: e.userId,
    name: e.user.username ?? "Player",
    score: e.score,
    prize: e.prize ?? 0,
    you: !!opts.userId && opts.userId === e.userId,
    played: (e.answered ?? 0) > 0,
  }));
  const limit = opts.limit ?? 20;
  return {
    gameId,
    fieldSize: ranked.length,
    standings: ranked.slice(0, limit),
    you: opts.userId ? ranked.find((r) => r.you) ?? null : null,
    settled: game.rankedAt != null,
  };
}

export type RecentEntrant = { userId: string; name: string; avatarId: string | null };

/** Most recent ticket buyers for a platform — real, paid `GameEntry` rows newest
 *  first, de-duplicated to distinct users. NOT scoped to the current round: it
 *  spans all games, so a fresh round (e.g. #54 with 2 buyers) backfills from the
 *  previous rounds (#53, #52, #51 …) and the strip is never empty. The Home
 *  "live buying" strip replays these on a paced client loop (restarting when
 *  exhausted) so real DB history reads as live activity, without a realtime
 *  channel. `take` over-scans so dedup still yields `limit` distinct users even
 *  when recent games are large. */
export async function recentEntrants(platform: UserPlatform, limit = 24): Promise<RecentEntrant[]> {
  const rows = await prisma.gameEntry.findMany({
    where: { paidAt: { not: null }, game: { platform, onchainId: { not: null } } },
    orderBy: { paidAt: "desc" },
    take: limit * 6,
    select: { userId: true, user: { select: { username: true, avatarId: true } } },
  });
  const seen = new Set<string>();
  const out: RecentEntrant[] = [];
  for (const r of rows) {
    if (seen.has(r.userId)) continue;
    seen.add(r.userId);
    out.push({ userId: r.userId, name: r.user.username ?? "Player", avatarId: r.user.avatarId ?? null });
    if (out.length >= limit) break;
  }
  return out;
}

/** A settled result to surface as a return-pop / in-app notification: the
 *  player's rank + prize in a recently-ranked game. `reward > 0` ⇒ they won. */
export type PlayerResult = { id: string; roundId: number; rank: number; reward: number };

/** The player's recent SETTLED tournament results (ranked games), newest first.
 *  Powers the "you're back — here's your result" popup + announcement cards.
 *  MiniPay has no push, so this is how a returning user learns they placed/won. */
export async function loadRecentResults(userId: string, limit = 5): Promise<PlayerResult[]> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days
  const entries = await prisma.gameEntry.findMany({
    where: { userId, rank: { not: null }, game: { rankedAt: { not: null, gte: since } } },
    orderBy: { game: { rankedAt: "desc" } },
    take: limit,
    select: { gameId: true, rank: true, prize: true, game: { select: { rankedAt: true } } },
  });
  return entries.map((e) => ({
    id: e.gameId,
    roundId: e.game.rankedAt!.getTime(),
    rank: e.rank!,
    reward: e.prize ?? 0,
  }));
}

/** The platform's latest tournament game (live or most-recently ended) — for the
 *  standalone leaderboard screen. */
export async function latestTournamentStandings(
  platform: UserPlatform,
  opts: { userId?: string; limit?: number } = {},
): Promise<TournamentBoard> {
  const game = await prisma.game.findFirst({
    where: { platform, onchainId: { not: null } },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });
  return tournamentStandings(game?.id ?? null, opts);
}

// ---------------------------------------------------------------------------
// Claim data — the merkle proof/amount the client needs to call claimPrize
// ---------------------------------------------------------------------------

export type TournamentClaim = {
  gameId: string;
  platform: UserPlatform;
  onchainId: `0x${string}`;
  /** Prize amount in token units (6-decimals), as a string for BigInt parsing. */
  amount: string;
  proof: `0x${string}`[];
};

/**
 * The player's claimable prize for a settled tournament game — the on-chain id +
 * merkle amount/proof written by `publishResults`. Null if not a winner, not yet
 * published, or already claimed. The on-chain `claimPrize` is then sent by the
 * client (`useTournamentWallet.claim`) and confirmed via the v1 claim route.
 */
export async function getTournamentClaim(
  userId: string,
  gameId: string,
): Promise<TournamentClaim | null> {
  const entry = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: {
      claimedAt: true,
      merkleAmount: true,
      merkleProof: true,
      game: { select: { onchainId: true, onChainAt: true, platform: true } },
    },
  });
  if (!entry || entry.claimedAt) return null;
  if (!entry.game.onChainAt || !entry.game.onchainId) return null;
  if (!entry.merkleAmount) return null;

  // A single-winner game has a one-leaf merkle tree, so the proof is an EMPTY
  // array — the leaf is the root, and the contract verifies it directly
  // (claimPrize(id, amount, []) succeeds). An empty proof is a valid claim, not
  // "nothing to claim"; only the published amount + unclaimed state matter here.
  const proof = Array.isArray(entry.merkleProof) ? (entry.merkleProof as string[]) : [];

  return {
    gameId,
    platform: entry.game.platform,
    onchainId: entry.game.onchainId as `0x${string}`,
    amount: entry.merkleAmount,
    proof: proof as `0x${string}`[],
  };
}

export type TournamentClaimItem = {
  gameId: string;
  gameNumber: number;
  title: string;
  rank: number;
  /** Prize in whole payment-token units (6-decimals → human), for display. */
  amount: number;
  wonAt: number;
};

/** The player's claimable on-chain prizes (settled + published + unclaimed),
 *  for the profile Prize Wallet list. */
export async function loadTournamentClaims(userId: string): Promise<TournamentClaimItem[]> {
  const entries = await prisma.gameEntry.findMany({
    where: {
      userId,
      claimedAt: null,
      prize: { gt: 0 },
      merkleAmount: { not: null },
      game: { onChainAt: { not: null }, onchainId: { not: null } },
    },
    select: {
      rank: true,
      merkleAmount: true,
      game: { select: { id: true, gameNumber: true, title: true, endsAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => ({
    gameId: e.game.id,
    gameNumber: e.game.gameNumber,
    title: e.game.title,
    rank: e.rank ?? 0,
    amount: Number(e.merkleAmount) / 10 ** PAYMENT_TOKEN_DECIMALS,
    wonAt: e.game.endsAt.getTime(),
  }));
}

/**
 * Confirm an on-chain prize claim: verify the player's `claimPrize` tx (reusing
 * v1's `verifyClaim`) and mark the entry claimed. Idempotent.
 */
export async function confirmTournamentClaim(input: {
  userId: string;
  gameId: string;
  txHash: string;
  wallet: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, gameId, txHash, wallet } = input;
  const entry = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: {
      id: true,
      claimedAt: true,
      game: { select: { onchainId: true, platform: true, network: true } },
    },
  });
  if (!entry) return { ok: false, error: "no_entry" };
  if (entry.claimedAt) return { ok: true };
  if (!entry.game.onchainId) return { ok: false, error: "game_not_onchain" };

  const verification = await verifyClaim({
    txHash: txHash as `0x${string}`,
    platform: entry.game.platform,
    network: entry.game.network,
    expectedGameId: entry.game.onchainId as `0x${string}`,
    expectedClaimer: wallet as `0x${string}`,
  });
  if (!verification.verified) {
    return { ok: false, error: verification.error ?? "claim_verification_failed" };
  }

  await prisma.gameEntry.update({
    where: { id: entry.id },
    data: { claimedAt: new Date() },
  });
  return { ok: true };
}

/**
 * Self-heal a stuck claim: a prize that's already claimed on-chain but still
 * shows as claimable because a prior confirm failed (e.g. transient RPC lag on
 * the hasClaimed read). Reads the contract's hasClaimed() for the player's
 * wallet and, if true, marks the entry claimed — no new transaction needed.
 * Idempotent and safe: only ever sets claimedAt when the chain says it's claimed.
 */
export async function reconcileTournamentClaim(input: {
  userId: string;
  gameId: string;
  wallet: string;
}): Promise<{ ok: boolean; reconciled: boolean; error?: string }> {
  const { userId, gameId, wallet } = input;
  const entry = await prisma.gameEntry.findUnique({
    where: { gameId_userId: { gameId, userId } },
    select: {
      id: true,
      claimedAt: true,
      game: { select: { onchainId: true, platform: true, network: true } },
    },
  });
  if (!entry) return { ok: false, reconciled: false, error: "no_entry" };
  if (entry.claimedAt) return { ok: true, reconciled: false };
  if (!entry.game.onchainId) return { ok: false, reconciled: false, error: "game_not_onchain" };

  const claimed = await isPrizeClaimedOnChain({
    platform: entry.game.platform,
    network: entry.game.network,
    gameId: entry.game.onchainId as `0x${string}`,
    claimer: wallet as `0x${string}`,
  });
  if (!claimed) return { ok: false, reconciled: false, error: "not_claimed_onchain" };

  await prisma.gameEntry.update({
    where: { id: entry.id },
    data: { claimedAt: new Date() },
  });
  return { ok: true, reconciled: true };
}
