/**
 * Notification Templates
 *
 * Centralized notification content for all game lifecycle events.
 * Each template returns { title, body } for the notification payload.
 *
 * Design principle: Every notification should escalate urgency over time
 * and include scarcity data (spots remaining) wherever available.
 */

import { env } from "@/lib/env";

// ==========================================
// TYPES
// ==========================================

export interface NotificationTemplate {
  title: string;
  body: string;
}

/**
 * The live game's details, so a card reads "World Cup Bowl #010" with its real
 * subject/pool instead of a generic "Waffles #010". All optional — callers that
 * don't have the row fall back to the plain "Waffles" framing.
 */
export interface GameMeta {
  /** The game's name, e.g. "World Cup Bowl". Falls back to "Waffles". */
  title?: string;
  /** Display subject, e.g. "Football" (themeLabel of the game's theme). */
  category?: string;
  /** Current prize pool in USDC, for the scarcity/stakes line. */
  prizePool?: number;
}

/** Helper to format game number with leading zeros */
const formatGameNum = (n: number) => String(n).padStart(3, "0");

/** Full labelled game, e.g. "World Cup Bowl #010". The stored title already
 *  carries the number (generateGameTitle bakes it in), so use it verbatim and
 *  only synthesize "Waffles #NNN" when no title is supplied. */
const gameLabel = (n: number, meta?: GameMeta) =>
  meta?.title?.trim() || `Waffles #${formatGameNum(n)}`;

/** Helper to format spots left */
const spotsText = (left: number) =>
  left <= 0 ? "SOLD OUT" : left === 1 ? "1 spot left" : `${left} spots left`;

// ==========================================
// PRE-GAME NOTIFICATIONS
// ==========================================

export const preGame = {
  /** When a new game is created and open for ticket purchases */
  gameOpen: (gameNumber: number, spotsLeft?: number, prizePool?: number, meta?: GameMeta): NotificationTemplate => ({
    title: `${gameLabel(gameNumber, meta)} is LIVE`,
    body: spotsLeft != null && prizePool != null
      ? `${spotsLeft} spots. $${prizePool} pot. Go.`
      : meta?.category
        ? `${meta.category} trivia is live. Grab your ticket before they're gone.`
        : "Tickets are available. Grab yours before they're gone.",
  }),

  /** When a new game is announced but tickets open later */
  gameScheduled: (gameNumber: number, meta?: GameMeta): NotificationTemplate => ({
    title: `${gameLabel(gameNumber, meta)} announced`,
    body: meta?.category
      ? `${meta.category} trivia incoming. Tickets drop soon.`
      : "New game incoming. Tickets drop soon.",
  }),

  /** 24 hours before game starts */
  countdown24h: (gameNumber: number, spotsLeft?: number): NotificationTemplate => ({
    title: `Waffles #${formatGameNum(gameNumber)} — tomorrow`,
    body: spotsLeft != null
      ? `${spotsText(spotsLeft)}. Get yours before they sell out.`
      : "Game starts tomorrow. Don't miss it.",
  }),

  /** 12 hours before game starts */
  countdown12h: (gameNumber: number, spotsLeft?: number): NotificationTemplate => ({
    title: "12 hours to go",
    body: spotsLeft != null
      ? `${spotsText(spotsLeft)} for Waffles #${formatGameNum(gameNumber)}. Clock's ticking.`
      : `Waffles #${formatGameNum(gameNumber)} is filling up. Get in.`,
  }),

  /** 3 hours before game starts */
  countdown3h: (gameNumber: number, spotsLeft?: number): NotificationTemplate => ({
    title: "3 hours left",
    body: spotsLeft != null
      ? `${spotsText(spotsLeft)}. This fills up every time.`
      : "Window's closing. Lock in your ticket.",
  }),

  /** 1 hour before game starts */
  countdown1h: (gameNumber: number, spotsLeft?: number): NotificationTemplate => ({
    title: "1 HOUR LEFT",
    body: spotsLeft != null
      ? `${spotsText(spotsLeft)} for Waffles #${formatGameNum(gameNumber)}. Last chance.`
      : "This is it. Get your ticket or get left behind.",
  }),

  /** 5 minutes before game starts */
  countdown5min: (gameNumber: number, spotsLeft?: number): NotificationTemplate => ({
    title: "5 MINUTES",
    body: spotsLeft != null && spotsLeft <= 5
      ? `${spotsText(spotsLeft)}. NOW OR NEVER.`
      : "Game starts in 5 minutes. Get your ticket immediately.",
  }),

  /** When game is almost full (90% of maxPlayers) */
  almostSoldOut: (gameNumber: number, spotsLeft?: number): NotificationTemplate => ({
    title: spotsLeft != null && spotsLeft <= 3
      ? `${spotsLeft} SPOTS LEFT`
      : "Almost sold out",
    body: spotsLeft != null
      ? `Waffles #${formatGameNum(gameNumber)} is almost gone. ${spotsText(spotsLeft)}.`
      : `Only a few tickets left for Waffles #${formatGameNum(gameNumber)}.`,
  }),

  /** When a game sells out — sent to non-ticket-holders */
  soldOut: (gameNumber: number): NotificationTemplate => ({
    title: "SOLD OUT",
    body: `Waffles #${formatGameNum(gameNumber)} is full. You missed it. Turn on notifications for next time.`,
  }),

  /** When a friend buys a ticket for a game */
  friendJoined: (
    gameNumber: number,
    friendUsername: string,
  ): NotificationTemplate => ({
    title: `${friendUsername} just bought in`,
    body: `They're playing Waffles #${formatGameNum(gameNumber)}. You in?`,
  }),

  /** When the prize pool gets sponsored */
  prizePoolBoost: (gameNumber: number, boostAmount: string, totalPrizePool: string): NotificationTemplate => ({
    title: `$${totalPrizePool} POT`,
    body: `Waffles #${formatGameNum(gameNumber)} prize pool just doubled. Bigger pot, same ticket price.`,
  }),
};

// ==========================================
// TICKET OPENING COUNTDOWN NOTIFICATIONS
// ==========================================

export const ticketOpen = {
  /** 3 hours before tickets open */
  countdown3h: (gameNumber: number): NotificationTemplate => ({
    title: "Tickets drop in 3 hours",
    body: `Waffles #${formatGameNum(gameNumber)}. Be ready.`,
  }),

  /** 1 hour before tickets open */
  countdown1h: (gameNumber: number): NotificationTemplate => ({
    title: "1 hour until tickets",
    body: `Waffles #${formatGameNum(gameNumber)} opens soon. Set your alarm.`,
  }),

  /** 30 minutes before tickets open */
  countdown30m: (gameNumber: number): NotificationTemplate => ({
    title: "30 minutes",
    body: `Waffles #${formatGameNum(gameNumber)} tickets are almost here.`,
  }),

  /** 15 minutes before tickets open */
  countdown15m: (gameNumber: number): NotificationTemplate => ({
    title: "15 MINUTES",
    body: `Waffles #${formatGameNum(gameNumber)} tickets drop very soon. Stay sharp.`,
  }),

  /** 5 minutes before tickets open */
  countdown5m: (gameNumber: number): NotificationTemplate => ({
    title: "TICKETS IN 5",
    body: `Waffles #${formatGameNum(gameNumber)} is about to open. Be the first in.`,
  }),

  /** Tickets are now open */
  nowOpen: (gameNumber: number, spotsLeft?: number, prizePool?: number): NotificationTemplate => ({
    title: "TICKETS ARE LIVE",
    body: spotsLeft != null && prizePool != null
      ? `Waffles #${formatGameNum(gameNumber)}. ${spotsLeft} spots. $${prizePool} pot. Go.`
      : `Waffles #${formatGameNum(gameNumber)} is open. Go go go.`,
  }),
};

// ==========================================
// LIVE GAME NOTIFICATIONS
// ==========================================

export const liveGame = {
  /** Player got passed on leaderboard */
  flipped: (gameNumber: number, byUsername: string): NotificationTemplate => ({
    title: `${byUsername} just passed you`,
    body: "They're coming for your spot. Get back in there.",
  }),

  /** Multiple friends overtook you */
  rivalryAlert: (count: number): NotificationTemplate => ({
    title: `${count} players just passed you`,
    body: "Your rank is slipping. Fight back.",
  }),
};

// ==========================================
// POST-GAME NOTIFICATIONS
// ==========================================

export const postGame = {
  /** Sent to top 3 winners */
  winner: (gameNumber: number, rank: number, prize?: string, meta?: GameMeta): NotificationTemplate => {
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    return {
      title: `#${rank} ${emoji} — You won`,
      body: prize
        ? `$${prize} is yours from ${gameLabel(gameNumber, meta)}. Tap to claim.`
        : `You placed #${rank} in ${gameLabel(gameNumber, meta)}. Tap to see your prize.`,
    };
  },

  /** Top 3 finish notification */
  topFinish: (gameNumber: number, rank: number): NotificationTemplate => {
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    return {
      title: `Top 3 finish ${emoji}`,
      body: `You crushed Waffles #${formatGameNum(gameNumber)}. Check the final standings.`,
    };
  },

  /** Sent to all non-winners */
  results: (gameNumber: number, meta?: GameMeta): NotificationTemplate => ({
    title: `${gameLabel(gameNumber, meta)} results`,
    body: meta?.category
      ? `${meta.category} trivia is settled. See who won and where you placed.`
      : "See who won and where you placed.",
  }),

  /** FOMO recap for warm players who SKIPPED this round — drives them into the
   *  next one. Leads with the pool that just paid out, since real money is the
   *  hook. */
  roundWrap: (gameNumber: number, meta?: GameMeta): NotificationTemplate => ({
    title: `${gameLabel(gameNumber, meta)} wrapped`,
    body:
      meta?.prizePool != null && meta.prizePool > 0
        ? `$${meta.prizePool.toFixed(2)} just went to the top 15. The next round's live — don't sit this one out.`
        : "The top 15 just split the pool. A new round's live — get in this time.",
  }),

  /** Reminder for unclaimed prizes */
  unclaimed: (gameNumber: number, amount: string): NotificationTemplate => ({
    title: `$${amount} waiting for you`,
    body: `Your Waffles #${formatGameNum(gameNumber)} winnings are unclaimed. Tap to collect.`,
  }),

  /** Confirmation when prize is claimed */
  claimed: (amount: string): NotificationTemplate => ({
    title: `$${amount} sent to your wallet`,
    body: "Prize claimed. See you next game.",
  }),
};

// ==========================================
// ONBOARDING NOTIFICATIONS
// ==========================================

export const onboarding = {
  /** Welcome message when user first joins */
  welcome: (): NotificationTemplate => ({
    title: "Welcome to Waffles",
    body: "Guess movie scenes. Beat other players. Win real money. Games run 3x/week.",
  }),
};

// ==========================================
// TRANSACTIONAL NOTIFICATIONS
// ==========================================

export const transactional = {
  /** Ticket purchase confirmation */
  ticketSecured: (timeStr: string): NotificationTemplate => ({
    title: "You're in",
    body: `Game starts ${timeStr}. Be ready to play.`,
  }),

  /** Auto-recovery confirmation when a missing paid ticket is restored */
  ticketRecovered: (count: number): NotificationTemplate => ({
    title: count === 1 ? "Ticket restored" : "Tickets restored",
    body:
      count === 1
        ? "We found a failed purchase and gave you a ticket. You're in."
        : `We found ${count} failed purchases and restored your tickets.`,
  }),
};

// ==========================================
// RETENTION & REENGAGEMENT
// ==========================================

export const retention = {
  /** Bring back inactive users */
  comeback: (gameNumber: number): NotificationTemplate => ({
    title: "Been a while",
    body: `Waffles #${formatGameNum(gameNumber)} is live. Your spot won't save itself.`,
  }),

  /** Streak reminder */
  streakReminder: (streak?: number): NotificationTemplate => ({
    title: streak ? `${streak}-day streak on the line` : "Your streak is on the line",
    body: "Play today or lose it.",
  }),
};

// ==========================================
// GROWTH NOTIFICATIONS (Quests)
// ==========================================

export const growth = {
  /** New quest available */
  newQuest: (title: string, description: string): NotificationTemplate => ({
    title: `New Quest: ${title}`,
    body: description,
  }),
};

// ==========================================
// HELPER: Build full notification payload
// ==========================================

export type NotificationContext =
  | "pregame"
  | "result"
  | "claim"
  | "quest"
  | "default";

export function buildPayload(
  template: NotificationTemplate,
  gameId?: string,
  context: NotificationContext = "default",
): { title: string; body: string; targetUrl: string } {
  const baseUrl = env.rootUrl;

  let targetUrl: string;

  if (context === "quest") {
    targetUrl = `${baseUrl}/game`;
  } else if (!gameId) {
    targetUrl = `${baseUrl}/game`;
  } else if (context === "result" || context === "claim") {
    targetUrl = `${baseUrl}/game/${gameId}/result`;
  } else {
    targetUrl = `${baseUrl}/game`;
  }

  return {
    title: template.title,
    body: template.body,
    targetUrl,
  };
}
