/**
 * Server source of truth for in-app announcements.
 *
 * Two streams feed the player banner/inbox:
 *  1. Authored announcements — `Announcement` rows (admin-created, scheduled via
 *     startsAt/endsAt, toggled with isActive). These ship without an app release.
 *  2. Triggered announcements — per-user, condition-driven cards computed live
 *     (e.g. an unclaimed prize). These are NOT DB rows: they carry an `auto:`
 *     id, auto-resolve when their condition clears, and are dismissed in-session
 *     only (read/dismiss persistence skips them — see playerState).
 *
 * `kind: "migration"` and `kind: "takeover"` rows are excluded here; they back
 * one-off modals (migrationNotice.ts, worldCupTakeover.ts), not feed cards.
 */
import { prisma } from "@/lib/db";
import { loadTournamentClaims, loadRecentResults } from "@/lib/player/tournamentGames";
import { displayStreak, dayKeyUTC } from "@/lib/player/dailyStreak";
import { defaultNetworkForPlatform } from "@/lib/chain/network";

export type AnnouncementTone = "maple" | "berry" | "leaf";

export type PlayerAnnouncement = {
  id: string;
  priority: number; // higher wins the banner slot + sorts first in the inbox
  tone: AnnouncementTone;
  emoji: string;
  title: string;
  body: string;
  // CTA either navigates to a screen, or opens a season takeover via `theme`.
  // When set, tapping the announcement runs the CTA instead of opening details.
  cta?: { label: string; screen?: string; theme?: string };
  // What tapping the announcement does (in the live toast or the bell inbox).
  // Every announcement shows as the transient top toast on delivery and is logged
  // in the inbox; `surface` only controls the tap behaviour:
  //   "toast" — the "disappears" category: informational, no modal on tap (default)
  //   "small" — tapping opens a compact bottom-sheet modal
  //   "full"  — tapping opens a full-screen takeover
  // Authored via the `ctaAction` value "open:small" / "open:full" (blank = toast).
  surface?: "toast" | "small" | "full";
  publishedAt: number;
  startsAt: number;
  endsAt: number;
  // Triggered (non-DB) cards are dismissed in-session only.
  ephemeral?: boolean;
};

/** Triggered announcement ids are prefixed so persistence/state can skip them. */
export const TRIGGERED_PREFIX = "auto:";
export const isTriggeredId = (id: string) => id.startsWith(TRIGGERED_PREFIX);

const FAR_FUTURE = Date.now() + 365 * 24 * 3_600_000;

function normalizeTone(tone: string): AnnouncementTone {
  return tone === "maple" || tone === "berry" || tone === "leaf" ? tone : "leaf";
}

/**
 * Parse the stored `ctaAction` into the tap behaviour:
 *   "screen:<name>" / "theme:<id>" → a navigating CTA
 *   "open:small" / "open:full"     → open the details as a modal
 *   anything else / empty          → the "disappears" toast: informational, no
 *                                     modal on tap.
 */
function parseAction(
  label: string | null,
  action: string | null,
): { cta?: PlayerAnnouncement["cta"]; surface?: PlayerAnnouncement["surface"] } {
  const [kind, value] = (action ?? "").split(":", 2);
  if (kind === "screen" && value && label) return { cta: { label, screen: value } };
  if (kind === "theme" && value && label) return { cta: { label, theme: value } };
  if (kind === "open") return { surface: value === "full" ? "full" : "small" };
  return { surface: "toast" };
}

export type DbAnnouncement = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaAction: string | null;
  tone: string;
  emoji: string;
  startsAt: Date | null;
  endsAt: Date | null;
  sortOrder: number;
  createdAt: Date;
};

export function mapDbAnnouncement(row: DbAnnouncement): PlayerAnnouncement {
  const { cta, surface } = parseAction(row.ctaLabel, row.ctaAction);
  return {
    id: row.id,
    priority: row.sortOrder,
    tone: normalizeTone(row.tone),
    emoji: row.emoji,
    title: row.title,
    body: row.body,
    cta,
    surface,
    publishedAt: row.createdAt.getTime(),
    startsAt: row.startsAt?.getTime() ?? 0,
    endsAt: row.endsAt?.getTime() ?? FAR_FUTURE,
  };
}

/**
 * Per-user, condition-driven announcements. Each rule returns 0 or 1 card; add
 * new rules here. Kept cheap (a couple of indexed reads) since it runs on load.
 */
async function computeTriggeredAnnouncements(userId: string): Promise<PlayerAnnouncement[]> {
  const out: PlayerAnnouncement[] = [];
  const now = Date.now();

  // Unclaimed prize — highest-intent nudge: real USDT is sitting in the wallet.
  const claims = await loadTournamentClaims(userId);
  if (claims.length > 0) {
    const total = claims.reduce((s, c) => s + c.amount, 0);
    out.push({
      id: `${TRIGGERED_PREFIX}prize-unclaimed`,
      priority: 100,
      tone: "maple",
      emoji: "💰",
      title: claims.length === 1 ? "You have a prize to claim" : `${claims.length} prizes to claim`,
      body: `${total.toFixed(2)} USDT is waiting in your Prize Wallet. Claim it before it slips your mind.`,
      cta: { label: "Open Prize Wallet", screen: "profile" },
      publishedAt: now,
      startsAt: 0,
      endsAt: FAR_FUTURE,
      ephemeral: true,
    });
  }

  // Recent settled result recap. A winner with an unclaimed prize is already
  // covered (higher-priority card above), so here we re-engage the player whose
  // result is informational: a "near-miss" placement that didn't reach the prize
  // bracket. It nudges them straight back into the next round while it stings.
  const [latest] = await loadRecentResults(userId, 1);
  if (latest && latest.reward <= 0) {
    out.push({
      id: `${TRIGGERED_PREFIX}result-${latest.id}`,
      priority: 80,
      tone: "leaf",
      emoji: "🎯",
      title: `You finished #${latest.rank} — so close`,
      body: "The prize bracket was just ahead. The next round is live — go again while you're warmed up.",
      cta: { label: "Play the next round", screen: "home" },
      publishedAt: latest.roundId,
      startsAt: 0,
      endsAt: FAR_FUTURE,
      ephemeral: true,
    });
  }

  // The remaining rules need the caller's platform (live-round + recap queries
  // are platform/network scoped) and streak state. One small read covers both.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { platform: true, streakFreezes: true },
  });
  if (!user) return out;

  const network = defaultNetworkForPlatform(user.platform);
  const usd = (n: number) => `$${n.toFixed(2)}`;

  // Live round available — the in-app stand-in for the ENTIRE Farcaster
  // countdown / ticket-open / almost-sold-out family. A push can't reach MiniPay
  // at "5 minutes left", so instead of time-anchored variants we show ONE
  // state-driven card reflecting whatever the round looks like the moment they
  // open the app. Only for players who haven't entered, while seats remain.
  // Lightweight direct read (not currentTournamentGame, which is heavy) since
  // this runs on every announcement load.
  const liveGame = await prisma.game.findFirst({
    where: {
      platform: user.platform,
      network,
      onchainId: { not: null },
      startsAt: { lte: new Date(now) },
      endsAt: { gt: new Date(now) },
    },
    orderBy: { startsAt: "desc" },
    select: { id: true, prizePool: true, playerCount: true, maxPlayers: true, endsAt: true },
  });
  if (liveGame) {
    const spotsLeft = Math.max(0, liveGame.maxPlayers - liveGame.playerCount);
    if (spotsLeft > 0) {
      const entered = await prisma.gameEntry.findFirst({
        where: { gameId: liveGame.id, userId, paidAt: { not: null } },
        select: { id: true },
      });
      if (!entered) {
        const pot = usd(liveGame.prizePool);
        const msLeft = liveGame.endsAt.getTime() - now;
        const closingSoon = msLeft <= 15 * 60 * 1000;
        const tight = spotsLeft <= 3;
        const spots = `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`;
        out.push({
          id: `${TRIGGERED_PREFIX}live-round`,
          priority: 90,
          tone: "maple",
          emoji: "🔴",
          title: closingSoon
            ? `Live round closes in ${Math.max(1, Math.round(msLeft / 60_000))}m`
            : tight
              ? spots
              : "A round is live now",
          body: closingSoon
            ? `${spots} · ${pot} pot. Last call — answer 6 and split it.`
            : tight
              ? `The live round's almost full — ${pot} pot. Grab a seat before it's gone.`
              : `${pot} pot. Answer 6, outscore the room, and split it.`,
          cta: { label: "Join the round", screen: "home" },
          publishedAt: now,
          startsAt: 0,
          endsAt: FAR_FUTURE,
          ephemeral: true,
        });
      }
    }
  }

  // Round-wrap FOMO — a recently-ended round the player SKIPPED (entrants get the
  // near-miss / win cards above instead). Leads with the pot that just paid out,
  // since real money is the hook. Capped to the last 6h so it stays fresh.
  const lastEnded = await prisma.game.findFirst({
    where: {
      platform: user.platform,
      network,
      onchainId: { not: null },
      endsAt: { lt: new Date(now), gt: new Date(now - 6 * 3_600_000) },
    },
    orderBy: { endsAt: "desc" },
    select: { id: true, prizePool: true },
  });
  if (lastEnded && lastEnded.prizePool > 0) {
    const playedIt = await prisma.gameEntry.findFirst({
      where: { gameId: lastEnded.id, userId, paidAt: { not: null } },
      select: { id: true },
    });
    if (!playedIt) {
      out.push({
        id: `${TRIGGERED_PREFIX}round-wrap-${lastEnded.id}`,
        priority: 70,
        tone: "leaf",
        emoji: "💸",
        title: `${usd(lastEnded.prizePool)} just got split`,
        body: "The top players split the pot on a round you sat out. Get in the next one.",
        cta: { label: "Play the next round", screen: "home" },
        publishedAt: now,
        startsAt: 0,
        endsAt: FAR_FUTURE,
        ephemeral: true,
      });
    }
  }

  // Streak on the line — a held streak not yet kept today. The daily-reward sheet
  // also nudges this, but a feed card persists in the inbox and shows on any
  // screen. DailyRewardClaim is the streak authority (see dailyStreak.ts).
  const lastClaim = await prisma.dailyRewardClaim.findFirst({
    where: { userId },
    orderBy: { dayKey: "desc" },
    select: { dayKey: true, streak: true },
  });
  const today = dayKeyUTC();
  const heldStreak = displayStreak(
    { currentStreak: lastClaim?.streak ?? 0, streakFreezes: user.streakFreezes, lastClaimDay: lastClaim?.dayKey ?? null },
    today,
  );
  if (heldStreak > 0 && lastClaim?.dayKey !== today) {
    out.push({
      id: `${TRIGGERED_PREFIX}streak-reminder`,
      priority: 60,
      tone: "berry",
      emoji: "🔥",
      title: `Your ${heldStreak}-day streak is on the line`,
      body: "Claim today's reward or play a level to keep it alive.",
      cta: { label: "Keep my streak", screen: "home" },
      publishedAt: now,
      startsAt: 0,
      endsAt: FAR_FUTURE,
      ephemeral: true,
    });
  }

  return out;
}

/**
 * The active announcement feed for a player: triggered cards first, then
 * targeted notification rows and authored rows, all sorted by priority (highest
 * first). Pass `null` for the unauthenticated/preview context to get authored
 * rows only.
 */
export async function loadAnnouncements(userId: string | null): Promise<PlayerAnnouncement[]> {
  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      isActive: true,
      // One-off modal gates and targeted notification rows are not global feed cards.
      kind: { notIn: ["migration", "takeover", "notification"] },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { sortOrder: "desc" },
    select: {
      id: true,
      title: true,
      body: true,
      ctaLabel: true,
      ctaAction: true,
      tone: true,
      emoji: true,
      startsAt: true,
      endsAt: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  const authored = rows.map(mapDbAnnouncement);
  const notifications = userId
    ? await prisma.$queryRaw<DbAnnouncement[]>`
        SELECT
          a."id",
          a."title",
          a."body",
          a."ctaLabel",
          a."ctaAction",
          a."tone",
          a."emoji",
          a."startsAt",
          a."endsAt",
          a."sortOrder",
          a."createdAt"
        FROM "Announcement" a
        INNER JOIN "AnnouncementRecipient" ar ON ar."announcementId" = a."id"
        WHERE
          ar."userId" = ${userId}
          AND a."isActive" = true
          AND a."kind" = 'notification'
          AND (a."startsAt" IS NULL OR a."startsAt" <= ${now})
          AND (a."endsAt" IS NULL OR a."endsAt" >= ${now})
        ORDER BY a."sortOrder" DESC, a."createdAt" DESC
      `
    : [];
  const triggered = userId ? await computeTriggeredAnnouncements(userId) : [];
  return [...triggered, ...notifications.map(mapDbAnnouncement), ...authored].sort(
    (a, b) => b.priority - a.priority,
  );
}
