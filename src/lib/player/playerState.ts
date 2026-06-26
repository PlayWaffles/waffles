/**
 * v2 player-state service — the real-data backbone behind the ported v2
 * `ProtoProvider`. Pure Prisma functions keyed by userId; the server actions in
 * `src/actions/v2.ts` resolve the current user and call these.
 *
 * Maps 1:1 onto the persistent slice of the `Proto` State in
 * `src/app/v2/_app/state.tsx` so the screens stay untouched (Stage B of the
 * migration). Ephemeral game logic (timers, per-question scoring, screen nav)
 * stays client-side; only durable state + authoritative actions live here.
 */
import { prisma } from "@/lib/db";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";
import { LevelTrack, TicketLedgerReason, type Prisma } from "@prisma";
import { PAYMENT_TOKEN_DECIMALS } from "@/lib/chain";
import { displayStreak, dayKeyUTC } from "@/lib/player/dailyStreak";
import { isTriggeredId } from "@/lib/player/announcements";
import { scoreToXp } from "@/lib/player/xp";

// Peg used to value an on-chain prize as in-app Syrup: 1 ticket = 0.10 USDT
// (matches the ticket buy price). merkleAmount is in payment-token base units
// (6 decimals), so its ticket value is (merkleAmount / 10^decimals) / 0.10.
const USDT_PER_TICKET = 0.1;
function merkleAmountToTickets(merkleAmount: string): number {
  const usdt = Number(merkleAmount) / 10 ** PAYMENT_TOKEN_DECIMALS;
  return Math.round(usdt / USDT_PER_TICKET);
}
import { accrueLeaguePoints } from "./leagues";

// ── Shape returned to the client (mirrors Proto persistent fields) ──────────
export type Track = "standard" | "world-cup";

export type Winning = {
  id: string;
  rank: number;
  tickets: number;
  wonAt: number;
  status: "pending" | "claimed" | "converted";
};

export type PlayerState = {
  tickets: number;
  xp: number;
  streak: number;
  lives: number;
  nextLifeAt: number | null;
  streakFreezes: number;
  rookieDone: boolean;
  username: string;
  avatarId: string | null;
  levelByTrack: Record<Track, number>;
  winnings: Winning[];
  lastTournamentRank: number | null;
  annRead: string[];
  annDismissed: string[];
  earnedBadges: string[];
  /** Whether the player has entered a paid tournament so far today (UTC) —
   *  gates the every-5-levels tournament upsell. */
  enteredTournamentToday: boolean;
};

// ── Track <-> enum mapping ──────────────────────────────────────────────────
const TRACK_TO_ENUM: Record<Track, LevelTrack> = {
  standard: LevelTrack.STANDARD,
  "world-cup": LevelTrack.WORLD_CUP,
};
const ENUM_TO_TRACK: Record<LevelTrack, Track> = {
  [LevelTrack.STANDARD]: "standard",
  [LevelTrack.WORLD_CUP]: "world-cup",
};

// ── Practice allowance / milestone economy (mirrors state.tsx pure helpers) ──
// `User.lives` is repurposed as the daily PRACTICE allowance: how many practice
// levels you can start today. It resets to PRACTICE_BASE each UTC day and is
// topped up by PRACTICE_PER_TOURNAMENT for every tournament entered that day —
// the more tournaments you play, the more practice you unlock. `User.nextLifeAt`
// is repurposed as the day-marker: the timestamp of the day the stored allowance
// belongs to (a different UTC day ⇒ the allowance has reset to base).
export const PRACTICE_BASE = 10; // free practice plays per UTC day
export const PRACTICE_PER_TOURNAMENT = 5; // bonus plays granted per tournament entry
// Kept for back-compat with existing imports/UI; LIVES_MAX is now the daily base
// (the allowance can exceed it via tournament top-ups).
export const LIVES_MAX = PRACTICE_BASE;
export const LIFE_REGEN_MS = 5 * 60 * 1000;
export const LIVES_REFILL_COST = 1;

/** The practice allowance in effect for the current UTC day. The stored value
 *  carries its day in `nextLifeAt`; on a new day it has reset to PRACTICE_BASE. */
export function practiceAllowance(lives: number, dayMarker: Date | null, today = dayKeyUTC()): number {
  return dayMarker && dayKeyUTC(dayMarker) === today ? lives : PRACTICE_BASE;
}

function ticketMilestoneInterval(level: number): number {
  if (level <= 20) return 5;
  if (level <= 50) return 10;
  if (level <= 100) return 20;
  return 25;
}
export function isLevelTicketMilestone(level: number): boolean {
  return level > 0 && level % ticketMilestoneInterval(level) === 0;
}

/** Credit lives regenerated since `nextLifeAt`. Pure; mirrors state.tsx regenLives. */
export function regenLives(
  lives: number,
  nextLifeAt: number | null,
  now: number,
): { lives: number; nextLifeAt: number | null } {
  if (lives >= LIVES_MAX || nextLifeAt == null) return { lives, nextLifeAt };
  let l = lives;
  let next = nextLifeAt;
  while (l < LIVES_MAX && now >= next) {
    l += 1;
    next += LIFE_REGEN_MS;
  }
  return { lives: l, nextLifeAt: l >= LIVES_MAX ? null : next };
}

// ── Defaults ────────────────────────────────────────────────────────────────
/** Ensure both level tracks exist for a user (idempotent). */
export async function ensurePlayerDefaults(userId: string): Promise<void> {
  await prisma.levelProgress.createMany({
    data: [
      { userId, track: LevelTrack.STANDARD, level: 1 },
      { userId, track: LevelTrack.WORLD_CUP, level: 1 },
    ],
    skipDuplicates: true,
  });
}

// ── Load ────────────────────────────────────────────────────────────────────
export async function loadPlayerState(userId: string): Promise<PlayerState> {
  await ensurePlayerDefaults(userId);

  // UTC day boundary for "entered a tournament today" (gates the level upsell).
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [user, progress, winnings, lastSettled, annStates, badges, lastClaim, enteredTodayEntry] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        username: true,
        avatarId: true,
        xp: true,
        ticketBalance: true,
        lives: true,
        nextLifeAt: true,
        streakFreezes: true,
        currentStreak: true,
        bestStreak: true,
        lastLoginAt: true,
        rookieCupAt: true,
      },
    }),
    prisma.levelProgress.findMany({ where: { userId }, select: { track: true, level: true } }),
    // Winnings = a player's on-chain tournament prizes, read straight from
    // GameEntry (the canonical merkle prize record). Status derives from
    // claimedAt; keyed by gameId so claiming acts on it via the merkle path.
    prisma.gameEntry.findMany({
      where: {
        userId,
        prize: { gt: 0 },
        merkleAmount: { not: null },
        game: { onChainAt: { not: null }, onchainId: { not: null } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        gameId: true,
        rank: true,
        merkleAmount: true,
        claimedAt: true,
        game: { select: { endsAt: true } },
      },
    }),
    prisma.roundEntry.findFirst({
      where: { userId, settled: true, finalRank: { not: null } },
      orderBy: { settledAt: "desc" },
      select: { finalRank: true },
    }),
    prisma.announcementState.findMany({
      where: { userId },
      select: { announcementId: true, readAt: true, dismissedAt: true },
    }),
    // Earned badges — the durable, cross-device record. The client unions this
    // with any badge freshly derived from current stats (and records new ones).
    prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    // Most recent daily-reward claim — the streak authority. Read-only here:
    // opening the app never advances or breaks a streak (only claiming does).
    prisma.dailyRewardClaim.findFirst({
      where: { userId },
      orderBy: { dayKey: "desc" },
      select: { dayKey: true },
    }),
    // Has the player entered a paid tournament yet today? (UTC) — upsell gate.
    prisma.gameEntry.findFirst({
      where: { userId, paidAt: { gte: todayStart } },
      select: { id: true },
    }),
  ]);

  const levelByTrack: Record<Track, number> = { standard: 1, "world-cup": 1 };
  for (const p of progress) levelByTrack[ENUM_TO_TRACK[p.track]] = p.level;

  // Practice allowance for today (resets to base on a new UTC day) — display
  // only, no write; the persisted reset happens on the next consume/top-up.
  const lives = practiceAllowance(user.lives, user.nextLifeAt ?? null);
  // Display-only streak: the held streak the player still has, without counting
  // today until it's claimed and without mutating anything on read.
  const streak = displayStreak({
    currentStreak: user.currentStreak,
    streakFreezes: user.streakFreezes,
    lastClaimDay: lastClaim?.dayKey ?? null,
  });

  return {
    tickets: user.ticketBalance,
    xp: user.xp,
    streak,
    lives,
    nextLifeAt: user.nextLifeAt?.getTime() ?? null,
    streakFreezes: user.streakFreezes,
    rookieDone: user.rookieCupAt != null,
    username: user.username ?? "",
    avatarId: user.avatarId,
    levelByTrack,
    winnings: winnings.map((w) => ({
      id: w.gameId,
      rank: w.rank ?? 0,
      tickets: merkleAmountToTickets(w.merkleAmount!),
      wonAt: w.game.endsAt.getTime(),
      status: w.claimedAt ? "claimed" : "pending",
    })),
    lastTournamentRank: lastSettled?.finalRank ?? null,
    annRead: annStates.filter((a) => a.readAt).map((a) => a.announcementId),
    annDismissed: annStates.filter((a) => a.dismissedAt).map((a) => a.announcementId),
    earnedBadges: badges.map((b) => b.badgeId),
    enteredTournamentToday: !!enteredTodayEntry,
  };
}

// ── Tickets (atomic balance + ledger) ───────────────────────────────────────
export async function adjustTickets(
  userId: string,
  delta: number,
  reason: TicketLedgerReason,
  opts: { refId?: string; note?: string; tx?: Prisma.TransactionClient } = {},
): Promise<number> {
  const run = async (db: Prisma.TransactionClient) => {
    const user = await db.user.update({
      where: { id: userId },
      // Clamp at 0: never let a balance go negative.
      data: { ticketBalance: { increment: delta } },
      select: { ticketBalance: true },
    });
    const balanceAfter = Math.max(0, user.ticketBalance);
    if (balanceAfter !== user.ticketBalance) {
      await db.user.update({ where: { id: userId }, data: { ticketBalance: balanceAfter } });
    }
    await db.ticketLedger.create({
      data: { userId, delta, balanceAfter, reason, refId: opts.refId, note: opts.note },
    });
    await trackServerEvent({
      name: "ticket_ledger_recorded",
      userId,
      tx: db,
      properties: {
        ticket_delta: delta,
        tickets_after: balanceAfter,
        ticket_reason: reason,
        ref_id_kind: opts.refId ? "hashed" : null,
        ref_id_hash: hashServerAnalyticsId(opts.refId),
        note: opts.note ?? null,
      },
    });
    return balanceAfter;
  };
  return opts.tx ? run(opts.tx) : prisma.$transaction(run);
}

// ── Level campaign ──────────────────────────────────────────────────────────
/** Advance a track by one level; credit a milestone ticket when earned. */
export async function advanceLevel(
  userId: string,
  track: Track,
  score: number,
): Promise<{ level: number; ticketAwarded: boolean }> {
  const xpGain = scoreToXp(score);
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.levelProgress.update({
      where: { userId_track: { userId, track: TRACK_TO_ENUM[track] } },
      data: { level: { increment: 1 } },
      select: { level: true },
    });
    if (xpGain) await tx.user.update({ where: { id: userId }, data: { xp: { increment: xpGain } } });
    const ticketAwarded = isLevelTicketMilestone(updated.level);
    if (ticketAwarded) {
      await adjustTickets(userId, 1, TicketLedgerReason.LEVEL_MILESTONE, {
        refId: `${track}:${updated.level}`,
        tx,
      });
    }
    await trackServerEvent({
      name: "level_advanced",
      userId,
      tx,
      properties: {
        level_track: track,
        level_number: updated.level,
        score,
        xp_delta: xpGain,
        ticket_delta: ticketAwarded ? 1 : 0,
      },
    });
    return { level: updated.level, ticketAwarded };
  });
  // League standing accrues the same score as XP — best-effort, outside the tx
  // so a leagues failure can't roll back the level advance.
  await accrueLeaguePoints(userId, xpGain);
  return result;
}

/** Consume one practice play when a level is STARTED. Applies the daily reset
 *  first (so the first play of a new day spends from the fresh base), then
 *  decrements. Stamps `nextLifeAt` to today as the allowance day-marker.
 *  (Named `loseLife` for back-compat with the existing client/route plumbing.) */
export async function loseLife(userId: string): Promise<{ lives: number; nextLifeAt: number | null }> {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lives: true, nextLifeAt: true },
    });
    const allowance = practiceAllowance(u.lives, u.nextLifeAt);
    const lives = Math.max(0, allowance - 1);
    const now = new Date();
    await tx.user.update({
      where: { id: userId },
      data: { lives, nextLifeAt: now },
    });
    await trackServerEvent({
      name: "practice_play_consumed",
      userId,
      tx,
      properties: { lives_before: allowance, lives_after: lives },
    });
    return { lives, nextLifeAt: now.getTime() };
  });
}

/** Spend Syrup to buy extra practice plays today (the repurposed "refill"). */
export async function refillLives(userId: string): Promise<{ lives: number; tickets: number } | null> {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lives: true, nextLifeAt: true, ticketBalance: true },
    });
    if (u.ticketBalance < LIVES_REFILL_COST) return null;
    const allowance = practiceAllowance(u.lives, u.nextLifeAt);
    const tickets = await adjustTickets(userId, -LIVES_REFILL_COST, TicketLedgerReason.LIVES_REFILL, { tx });
    const lives = allowance + PRACTICE_PER_TOURNAMENT;
    await tx.user.update({ where: { id: userId }, data: { lives, nextLifeAt: new Date() } });
    await trackServerEvent({
      name: "practice_plays_bought",
      userId,
      tx,
      properties: {
        lives_before: allowance,
        lives_after: lives,
        tickets_before: u.ticketBalance,
        tickets_after: tickets,
        ticket_delta: -LIVES_REFILL_COST,
      },
    });
    return { lives, tickets };
  });
}

/** Grant the per-tournament practice top-up (called once when a tournament entry
 *  is recorded). Applies the daily reset first, then adds the bonus on top. */
export async function grantTournamentPracticePlays(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { lives: true, nextLifeAt: true },
    });
    if (!u) return;
    const allowance = practiceAllowance(u.lives, u.nextLifeAt);
    await tx.user.update({
      where: { id: userId },
      data: { lives: allowance + PRACTICE_PER_TOURNAMENT, nextLifeAt: new Date() },
    });
    await trackServerEvent({
      name: "practice_plays_granted_tournament",
      userId,
      tx,
      properties: { lives_before: allowance, lives_after: allowance + PRACTICE_PER_TOURNAMENT },
    });
  });
}

// ── Announcements ───────────────────────────────────────────────────────────
// Triggered (`auto:`) announcements aren't DB rows — their read/dismiss state is
// session-local (the condition resolves them), so skip the FK-backed persistence.
export async function setAnnouncementRead(userId: string, ids: string[]): Promise<void> {
  await Promise.all(
    ids
      .filter((id) => !isTriggeredId(id))
      .map((announcementId) =>
        prisma.announcementState.upsert({
          where: { userId_announcementId: { userId, announcementId } },
          create: { userId, announcementId, readAt: new Date() },
          update: { readAt: new Date() },
        }),
      ),
  );
}
export async function setAnnouncementDismissed(userId: string, id: string): Promise<void> {
  if (isTriggeredId(id)) return;
  await prisma.announcementState.upsert({
    where: { userId_announcementId: { userId, announcementId: id } },
    create: { userId, announcementId: id, dismissedAt: new Date() },
    update: { dismissedAt: new Date() },
  });
}

// ── Profile ─────────────────────────────────────────────────────────────────
export async function setUsername(userId: string, username: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { username: username.slice(0, 100) } });
}

export async function setAvatar(userId: string, avatarId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { avatarId: avatarId.slice(0, 40) } });
}

// ── Badges (persist the earned moment; definitions stay client-derived) ──────
export async function recordBadge(userId: string, badgeId: string): Promise<void> {
  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId, badgeId } },
    create: { userId, badgeId },
    update: {},
  });
}

/**
 * Permanently delete a user and all their owned data. Most child rows are
 * `onDelete: Cascade`, but a few FKs are `Restrict` (would block the delete) or
 * point at SHARED rows that must be detached rather than deleted:
 *   - GameEntry / AuditLog / ReferralReward → owned, removed first
 *   - InviteCode.usedById / User.referredById → shared, set null (don't delete
 *     someone else's invite code or orphan-delete the users they referred)
 *   - AnalyticsEvent.userId is SetNull; everything else cascades.
 * Atomic: a failure rolls the whole thing back. Used by the self-serve "delete
 * my account" reset.
 */
export async function deleteOwnAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Detach shared rows that merely reference this user.
    await tx.inviteCode.updateMany({ where: { usedById: userId }, data: { usedById: null } });
    await tx.user.updateMany({ where: { referredById: userId }, data: { referredById: null } });
    // Remove owned rows whose FK to User is Restrict (so the delete won't block).
    await tx.referralReward.deleteMany({ where: { inviterId: userId } });
    await tx.gameEntry.deleteMany({ where: { userId } });
    await tx.auditLog.deleteMany({ where: { adminId: userId } });
    // Everything else is Cascade / SetNull.
    await tx.user.delete({ where: { id: userId } });
  });
}
