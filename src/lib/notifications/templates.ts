/**
 * Notification Templates
 *
 * Centralized notification content for all game lifecycle events.
 * Each template returns { title, body } for the notification payload.
 */

import { env } from "@/lib/env";

// ==========================================
// TYPES
// ==========================================

export interface NotificationTemplate {
  title: string;
  body: string;
}

/** Helper to format game number with leading zeros */
const formatGameNum = (n: number) => String(n).padStart(3, "0");

// ==========================================
// PRE-GAME NOTIFICATIONS
// ==========================================

export const preGame = {
  /** When a new game is created and open for ticket purchases */
  gameOpen: (gameNumber: number): NotificationTemplate => ({
    title: `Waffles #${formatGameNum(gameNumber)} is Open! 🚪`,
    body: "Tickets are available now. Grab yours before the rush!",
  }),

  /** When a new game is announced but tickets open later */
  gameScheduled: (gameNumber: number): NotificationTemplate => ({
    title: `Waffles #${formatGameNum(gameNumber)} Announced! 📣`,
    body: "A new game is coming. Stay tuned for when tickets drop!",
  }),

  /** 24 hours before game starts */
  countdown24h: (gameNumber: number): NotificationTemplate => ({
    title: "24 Hours Left ⏳",
    body: `Waffles #${formatGameNum(gameNumber)} starts tomorrow. Secure your spot now.`,
  }),

  /** 12 hours before game starts */
  countdown12h: (gameNumber: number): NotificationTemplate => ({
    title: "12 Hours to Go 🌗",
    body: "Tickets are selling fast. Don't get left behind!",
  }),

  /** 3 hours before game starts */
  countdown3h: (gameNumber: number): NotificationTemplate => ({
    title: "3 Hours Warning ⚠️",
    body: `The window is closing. Lock in your ticket for Waffles #${formatGameNum(gameNumber)}!`,
  }),

  /** 1 hour before game starts */
  countdown1h: (gameNumber: number): NotificationTemplate => ({
    title: "1 Hour Remaining 🚨",
    body: `This is your last chance to join Waffles #${formatGameNum(gameNumber)}. Hurry!`,
  }),

  /** 5 minutes before game starts */
  countdown5min: (gameNumber: number): NotificationTemplate => ({
    title: "Starting in 5 Minutes! 🧨",
    body: "Game on! Get your ticket immediately or miss out.",
  }),

  /** When game is almost full (90% of maxPlayers) */
  almostSoldOut: (gameNumber: number): NotificationTemplate => ({
    title: "Almost Sold Out! 📉",
    body: `Only a few tickets left for Waffles #${formatGameNum(gameNumber)}. Secure yours now!`,
  }),

  /** When a friend buys a ticket for a game */
  friendJoined: (
    gameNumber: number,
    friendUsername: string,
  ): NotificationTemplate => ({
    title: `A Friend joined Waffles #${formatGameNum(gameNumber)}! 🫣`,
    body: "Tap to see who just bought a ticket.",
  }),

  /** When the prize pool gets sponsored */
  prizePoolBoost: (gameNumber: number, boostAmount: string, totalPrizePool: string): NotificationTemplate => ({
    title: `Waffles #${formatGameNum(gameNumber)} Just Got a 2x Boost 🧇`,
    body: `Prize pool is now $${totalPrizePool}. You're welcome.`,
  }),
};

// ==========================================
// TICKET OPENING COUNTDOWN NOTIFICATIONS
// ==========================================

export const ticketOpen = {
  /** 3 hours before tickets open */
  countdown3h: (gameNumber: number): NotificationTemplate => ({
    title: "Tickets Open in 3 Hours! \u23F3",
    body: `Waffles #${formatGameNum(gameNumber)} tickets drop soon. Get ready!`,
  }),

  /** 1 hour before tickets open */
  countdown1h: (gameNumber: number): NotificationTemplate => ({
    title: "1 Hour Until Tickets! \uD83D\uDEA8",
    body: `Waffles #${formatGameNum(gameNumber)} tickets open in 60 minutes. Don't miss out!`,
  }),

  /** 30 minutes before tickets open */
  countdown30m: (gameNumber: number): NotificationTemplate => ({
    title: "30 Minutes to Go! \uD83D\uDD25",
    body: `Waffles #${formatGameNum(gameNumber)} tickets are almost here. Be the first in line!`,
  }),

  /** 15 minutes before tickets open */
  countdown15m: (gameNumber: number): NotificationTemplate => ({
    title: "15 Minutes! \u26A1",
    body: `Waffles #${formatGameNum(gameNumber)} tickets open very soon. Stay sharp!`,
  }),

  /** 5 minutes before tickets open */
  countdown5m: (gameNumber: number): NotificationTemplate => ({
    title: "Tickets in 5 Minutes! \uD83E\uDDE8",
    body: `Waffles #${formatGameNum(gameNumber)} is about to open. Grab yours the second they drop!`,
  }),

  /** Tickets are now open */
  nowOpen: (gameNumber: number): NotificationTemplate => ({
    title: "Tickets Are LIVE! \uD83D\uDEAA",
    body: `Waffles #${formatGameNum(gameNumber)} tickets are available now. Go go go!`,
  }),
};

// ==========================================
// LIVE GAME NOTIFICATIONS
// ==========================================

export const liveGame = {
  /** Player got passed on leaderboard */
  flipped: (gameNumber: number, byUsername: string): NotificationTemplate => ({
    title: "Ouch! You just got flipped 📉",
    body: `${byUsername} just passed you on the leaderboard. Take back your spot!`,
  }),

  /** Multiple friends overtook you */
  rivalryAlert: (count: number): NotificationTemplate => ({
    title: "Rivalry Alert! ⚔️",
    body: `Your friend + ${count} others just overtook you.`,
  }),

  /** Chat is active */
  chatActive: (messageCount: number): NotificationTemplate => ({
    title: `${messageCount}+ new messages! 💬`,
    body: "The chat is blowing up! See what everyone is saying.",
  }),
};

// ==========================================
// POST-GAME NOTIFICATIONS
// ==========================================

export const postGame = {
  /** Sent to top 3 winners */
  winner: (gameNumber: number, rank: number): NotificationTemplate => {
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    return {
      title: "You're a Winner! 🎉",
      body: `You placed #${rank} ${emoji} in Waffles #${formatGameNum(gameNumber)}! Tap to see your prize.`,
    };
  },

  /** Top 3 finish notification */
  topFinish: (gameNumber: number, rank: number): NotificationTemplate => {
    const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
    return {
      title: `Top 3 Finish! ${emoji}`,
      body: `You crushed Waffles #${formatGameNum(gameNumber)}! See where your friends ranked.`,
    };
  },

  /** Sent to all non-winners */
  results: (gameNumber: number): NotificationTemplate => ({
    title: `Waffles #${formatGameNum(gameNumber)} Results are in 📊`,
    body: "Not a winner this time? Check the final leaderboard here.",
  }),

  /** Reminder for unclaimed prizes */
  unclaimed: (gameNumber: number, amount: string): NotificationTemplate => ({
    title: "You have unclaimed cash! 💸",
    body: `You won ${amount} in Waffles #${formatGameNum(gameNumber)}. Tap to claim your prize now.`,
  }),

  /** Confirmation when prize is claimed */
  claimed: (amount: string): NotificationTemplate => ({
    title: "💰 Prize Claimed!",
    body: `Cha-ching! ${amount} has been sent to your wallet. Enjoy!`,
  }),
};

// ==========================================
// ONBOARDING NOTIFICATIONS
// ==========================================

export const onboarding = {
  /** Welcome message when user first joins */
  welcome: (): NotificationTemplate => ({
    title: "Welcome to Waffles! 🧇",
    body: "Get ready to predict, win, and earn.",
  }),
};

// ==========================================
// TRANSACTIONAL NOTIFICATIONS
// ==========================================

export const transactional = {
  /** Ticket purchase confirmation */
  ticketSecured: (timeStr: string): NotificationTemplate => ({
    title: "🧇 Ticket Secured!",
    body: `Game starts ${timeStr}. Don't miss it!`,
  }),

  /** Auto-recovery confirmation when a missing paid ticket is restored */
  ticketRecovered: (count: number): NotificationTemplate => ({
    title: count === 1 ? "Ticket Restored! 🧇" : "Tickets Restored! 🧇",
    body:
      count === 1
        ? "We found your recent purchase failed and we gave you a ticket automatically."
        : `We found ${count} recent purchases and we gave you tickets automatically.`,
  }),
};

// ==========================================
// RETENTION & REENGAGEMENT
// ==========================================

export const retention = {
  /** Bring back inactive users */
  comeback: (gameNumber: number): NotificationTemplate => ({
    title: "Ready for a comeback? 👀",
    body: `Waffles #${formatGameNum(gameNumber)} is live! It's time to get back in the game.`,
  }),

  /** Streak reminder */
  streakReminder: (): NotificationTemplate => ({
    title: "Don't break your streak! 🔥",
    body: "Keep the fire alive. Play a game today to maintain your status.",
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

  // Route to appropriate page based on context
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
