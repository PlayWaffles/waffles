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
import { loadTournamentClaims } from "@/lib/player/tournamentGames";

export type AnnouncementTone = "maple" | "berry" | "leaf";

export type PlayerAnnouncement = {
  id: string;
  priority: number; // higher wins the banner slot + sorts first in the inbox
  tone: AnnouncementTone;
  emoji: string;
  title: string;
  body: string;
  // CTA either navigates to a screen, or opens a season takeover via `theme`.
  cta?: { label: string; screen?: string; theme?: string };
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

/** Parse the stored `ctaAction` ("screen:<name>" | "theme:<id>") into a CTA. */
function parseCta(
  label: string | null,
  action: string | null,
): PlayerAnnouncement["cta"] {
  if (!label || !action) return undefined;
  const [kind, value] = action.split(":", 2);
  if (kind === "screen" && value) return { label, screen: value };
  if (kind === "theme" && value) return { label, theme: value };
  return undefined;
}

type DbAnnouncement = {
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

function mapDbAnnouncement(row: DbAnnouncement): PlayerAnnouncement {
  return {
    id: row.id,
    priority: row.sortOrder,
    tone: normalizeTone(row.tone),
    emoji: row.emoji,
    title: row.title,
    body: row.body,
    cta: parseCta(row.ctaLabel, row.ctaAction),
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

  return out;
}

/**
 * The active announcement feed for a player: triggered cards first, then
 * authored rows, all sorted by priority (highest first). Pass `null` for the
 * unauthenticated/preview context to get authored rows only.
 */
export async function loadAnnouncements(userId: string | null): Promise<PlayerAnnouncement[]> {
  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      isActive: true,
      // "migration" + "takeover" are one-off modal gate rows, not feed cards.
      kind: { notIn: ["migration", "takeover"] },
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
  const triggered = userId ? await computeTriggeredAnnouncements(userId) : [];
  return [...triggered, ...authored].sort((a, b) => b.priority - a.priority);
}
