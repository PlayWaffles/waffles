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
import { isTriggeredId } from "@/lib/player/announcements";

// Peg used to value an on-chain prize as in-app Syrup: 1 ticket = 0.1 USDT.
// merkleAmount is in payment-token base units (6 decimals), so its ticket value
// is (merkleAmount / 10^decimals) / 0.1.
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
  username: string;
  avatarId: string | null;
  levelByTrack: Record<Track, number>;
  winnings: Winning[];
  lastTournamentRank: number | null;
  annRead: string[];
  annDismissed: string[];
  earnedBadges: string[];
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

// ── Lives / milestone economy (mirrors state.tsx pure helpers) ──────────────
export const LIVES_MAX = 5;
export const LIFE_REGEN_MS = 5 * 60 * 1000;
export const LIVES_REFILL_COST = 1;

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

  const [user, progress, winnings, lastSettled, annStates, badges] = await Promise.all([
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
  ]);

  const levelByTrack: Record<Track, number> = { standard: 1, "world-cup": 1 };
  for (const p of progress) levelByTrack[ENUM_TO_TRACK[p.track]] = p.level;

  // Reconcile lives on read so the meter is correct without a write.
  const regen = regenLives(user.lives, user.nextLifeAt?.getTime() ?? null, Date.now());

  return {
    tickets: user.ticketBalance,
    xp: user.xp,
    streak: user.currentStreak,
    lives: regen.lives,
    nextLifeAt: regen.nextLifeAt,
    streakFreezes: user.streakFreezes,
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
  xpGain: number,
): Promise<{ level: number; ticketAwarded: boolean }> {
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

/** Consume one life on a failed level; start the regen clock if we were full. */
export async function loseLife(userId: string): Promise<{ lives: number; nextLifeAt: number | null }> {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lives: true, nextLifeAt: true },
    });
    const reg = regenLives(u.lives, u.nextLifeAt?.getTime() ?? null, Date.now());
    const wasFull = reg.lives >= LIVES_MAX;
    const lives = Math.max(0, reg.lives - 1);
    const nextLifeAt = wasFull ? Date.now() + LIFE_REGEN_MS : reg.nextLifeAt;
    await tx.user.update({
      where: { id: userId },
      data: { lives, nextLifeAt: nextLifeAt == null ? null : new Date(nextLifeAt) },
    });
    await trackServerEvent({
      name: "life_lost_authoritative",
      userId,
      tx,
      properties: {
        lives_before: reg.lives,
        lives_after: lives,
        next_life_at_present: nextLifeAt != null,
      },
    });
    return { lives, nextLifeAt };
  });
}

/** Spend a ticket to refill lives to full. */
export async function refillLives(userId: string): Promise<{ lives: number; tickets: number } | null> {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { lives: true, ticketBalance: true },
    });
    if (u.lives >= LIVES_MAX || u.ticketBalance < LIVES_REFILL_COST) return null;
    const tickets = await adjustTickets(userId, -LIVES_REFILL_COST, TicketLedgerReason.LIVES_REFILL, { tx });
    await tx.user.update({ where: { id: userId }, data: { lives: LIVES_MAX, nextLifeAt: null } });
    await trackServerEvent({
      name: "lives_refill_authoritative",
      userId,
      tx,
      properties: {
        lives_before: u.lives,
        lives_after: LIVES_MAX,
        tickets_before: u.ticketBalance,
        tickets_after: tickets,
        ticket_delta: -LIVES_REFILL_COST,
      },
    });
    return { lives: LIVES_MAX, tickets };
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
