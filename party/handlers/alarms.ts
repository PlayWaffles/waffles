// Alarm phase handlers for PartyKit server

import type * as Party from "partykit/server";
import type { AlarmPhase } from "../types";
import type { Message } from "../../shared/protocol";

interface GameServer {
  room: Party.Room;
  getOnlineCount(): number;
  broadcast(msg: Message): void;
  sendNotifications(message: string, roomId?: string): Promise<void>;
}

// ==========================================
// COUNTDOWN PHASE CONFIG
// ==========================================

interface CountdownPhase {
  phase: AlarmPhase;
  offsetMs: number; // Time before startsAt
  nextPhase: AlarmPhase;
  title: string;
  body: string;
}

interface LiveJoinPhase {
  phase: AlarmPhase;
  offsetBeforeTicketCloseMs: number; // Time before late-entry closes
  nextPhase: AlarmPhase;
  title: string;
  body: string;
}

const TICKET_CLOSE_BUFFER_MS = 5 * 60 * 1000;

/**
 * Countdown phases in chronological order (earliest to latest)
 * Each phase sends a notification and schedules the next
 */
const COUNTDOWN_PHASES: CountdownPhase[] = [
  {
    phase: "24h",
    offsetMs: 24 * 60 * 60 * 1000,
    nextPhase: "12h",
    title: "Waffles — tomorrow",
    body: "Get your ticket now. These sell out.",
  },
  {
    phase: "12h",
    offsetMs: 12 * 60 * 60 * 1000,
    nextPhase: "6h",
    title: "12 hours to go",
    body: "Spots are going. Don't wait.",
  },
  {
    phase: "6h",
    offsetMs: 6 * 60 * 60 * 1000,
    nextPhase: "3h",
    title: "6 hours left",
    body: "Tickets selling fast. This fills up every time.",
  },
  {
    phase: "3h",
    offsetMs: 3 * 60 * 60 * 1000,
    nextPhase: "1h",
    title: "3 hours left",
    body: "Window's closing. Get your ticket.",
  },
  {
    phase: "1h",
    offsetMs: 1 * 60 * 60 * 1000,
    nextPhase: "30min",
    title: "1 HOUR LEFT",
    body: "Last chance to get in. Don't get locked out.",
  },
  {
    phase: "30min",
    offsetMs: 30 * 60 * 1000,
    nextPhase: "15min",
    title: "30 MINUTES",
    body: "Tickets are almost gone. Get in now.",
  },
  {
    phase: "15min",
    offsetMs: 15 * 60 * 1000,
    nextPhase: "5min",
    title: "15 MINUTES",
    body: "Final warning. Spots running out.",
  },
  {
    phase: "5min",
    offsetMs: 5 * 60 * 1000,
    nextPhase: "1min",
    title: "5 MINUTES",
    body: "Get your ticket NOW or miss out.",
  },
  {
    phase: "1min",
    offsetMs: 1 * 60 * 1000,
    nextPhase: "start",
    title: "1 MINUTE",
    body: "This is it. Waffles is starting.",
  },
];

/**
 * Live-game reminder phases in chronological order (earliest to latest).
 * These are scheduled off the late-entry close time so reminders stay aligned
 * with the actual join window, not the final game end.
 */
const LIVE_JOIN_PHASES: LiveJoinPhase[] = [
  {
    phase: "live60m",
    offsetBeforeTicketCloseMs: 60 * 60 * 1000,
    nextPhase: "live30m",
    title: "Game is live — 1 hour to join",
    body: "Late entry is open. Get in before it closes.",
  },
  {
    phase: "live30m",
    offsetBeforeTicketCloseMs: 30 * 60 * 1000,
    nextPhase: "live10m",
    title: "30 minutes to join",
    body: "Join window closing soon. This is your last shot.",
  },
  {
    phase: "live10m",
    offsetBeforeTicketCloseMs: 10 * 60 * 1000,
    nextPhase: "gameEnd",
    title: "FINAL 10 MINUTES",
    body: "Ticket sales close in 10 minutes. Now or never.",
  },
];

function getTicketCloseTime(endsAt: number): number {
  return endsAt - TICKET_CLOSE_BUFFER_MS;
}

/**
 * Get the first countdown phase that hasn't passed yet
 */
export function getFirstCountdownPhase(
  startsAt: number,
  now: number,
): AlarmPhase | null {
  for (const phase of COUNTDOWN_PHASES) {
    const alarmTime = startsAt - phase.offsetMs;
    if (alarmTime > now) {
      return phase.phase;
    }
  }
  // All countdown phases have passed, go directly to start
  if (startsAt > now) return "start";
  return null;
}

/**
 * Get the first live reminder phase that hasn't passed yet.
 * Falls back to the game end alarm once all live join reminders are past.
 */
export function getFirstLivePhase(
  endsAt: number,
  now: number,
): AlarmPhase | null {
  for (const phase of LIVE_JOIN_PHASES) {
    const alarmTime = getTicketCloseTime(endsAt) - phase.offsetBeforeTicketCloseMs;
    if (alarmTime > now) {
      return phase.phase;
    }
  }

  if (endsAt > now) return "gameEnd";
  return null;
}

/**
 * Get alarm time for a phase
 */
export function getAlarmTimeForPhase(
  phase: AlarmPhase,
  startsAt: number,
  endsAt: number,
): number | null {
  const config = COUNTDOWN_PHASES.find((p) => p.phase === phase);
  if (config) return startsAt - config.offsetMs;
  const liveConfig = LIVE_JOIN_PHASES.find((p) => p.phase === phase);
  if (liveConfig) return getTicketCloseTime(endsAt) - liveConfig.offsetBeforeTicketCloseMs;
  if (phase === "start") return startsAt;
  if (phase === "gameEnd") return endsAt;
  return null;
}

export async function scheduleNextLiveOrEndAlarm(
  server: GameServer,
  endsAt: number,
  now = Date.now(),
): Promise<AlarmPhase | null> {
  const nextPhase = getFirstLivePhase(endsAt, now);
  if (!nextPhase) {
    return null;
  }

  const nextAlarmTime = getAlarmTimeForPhase(nextPhase, 0, endsAt);
  if (!nextAlarmTime || nextAlarmTime <= now) {
    return null;
  }

  await server.room.storage.put("alarmPhase", nextPhase);
  await server.room.storage.setAlarm(nextAlarmTime);

  console.log("[PartyKit]", "live_next_scheduled", {
    nextPhase,
    at: new Date(nextAlarmTime).toISOString(),
  });

  return nextPhase;
}

// ==========================================
// COUNTDOWN ALARM HANDLER
// ==========================================

/**
 * Handle countdown alarms (24h, 12h, 3h, 1h, 5min)
 */
export async function handleCountdownAlarm(
  server: GameServer,
  phase: AlarmPhase,
): Promise<void> {
  const gameId = await server.room.storage.get<string>("gameId");
  const startsAt = await server.room.storage.get<number>("startsAt");

  const config = COUNTDOWN_PHASES.find((p) => p.phase === phase);
  if (!config || !startsAt) {
    console.error("[PartyKit]", "countdown_missing_config", { phase, gameId });
    return;
  }

  console.log("[PartyKit]", "countdown_alarm", { phase, gameId });

  // Send notification
  await server.sendNotifications(`${config.title}\n${config.body}`);

  // Schedule next phase
  const nextAlarmTime = getAlarmTimeForPhase(config.nextPhase, startsAt, 0);
  if (nextAlarmTime && nextAlarmTime > Date.now()) {
    await server.room.storage.put("alarmPhase", config.nextPhase);
    await server.room.storage.setAlarm(nextAlarmTime);
    console.log("[PartyKit]", "countdown_next_scheduled", {
      nextPhase: config.nextPhase,
    });
  }
}

/**
 * Handle live-game join reminder alarms.
 */
export async function handleLiveJoinAlarm(
  server: GameServer,
  phase: AlarmPhase,
): Promise<void> {
  const gameId = await server.room.storage.get<string>("gameId");
  const endsAt = await server.room.storage.get<number>("endsAt");

  const config = LIVE_JOIN_PHASES.find((p) => p.phase === phase);
  if (!config || !endsAt) {
    console.error("[PartyKit]", "live_join_missing_config", { phase, gameId });
    return;
  }

  console.log("[PartyKit]", "live_join_alarm", { phase, gameId });

  await server.sendNotifications(`${config.title}\n${config.body}`);

  const nextAlarmTime = getAlarmTimeForPhase(config.nextPhase, 0, endsAt);
  if (nextAlarmTime && nextAlarmTime > Date.now()) {
    await server.room.storage.put("alarmPhase", config.nextPhase);
    await server.room.storage.setAlarm(nextAlarmTime);
    console.log("[PartyKit]", "live_join_next_scheduled", {
      nextPhase: config.nextPhase,
      at: new Date(nextAlarmTime).toISOString(),
    });
  }
}

// ==========================================
// EXISTING HANDLERS
// ==========================================

/**
 * Handle start alarm - game goes live
 */
export async function handleStartAlarm(
  server: GameServer,
  roomId: string,
): Promise<void> {
  const gameId = await server.room.storage.get<string>("gameId");
  const endsAt = await server.room.storage.get<number>("endsAt");

  console.log("[PartyKit]", "start_phase_begin", {
    gameId,
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
  });

  if (!endsAt) {
    console.error("[PartyKit]", "start_phase_no_endsAt", { gameId });
    return;
  }

  await server.sendNotifications("The game has started! 🚀", roomId);
  server.broadcast({ type: "game:live" });
  await scheduleNextLiveOrEndAlarm(server, endsAt);

  console.log("[PartyKit]", "start_phase_complete", {
    gameId,
    connectedClients: server.getOnlineCount(),
  });
}

/**
 * Handle game end alarm - triggers roundup
 */
export async function handleGameEndAlarm(
  server: GameServer,
  _roomId: string,
): Promise<void> {
  const gameId = await server.room.storage.get<string>("gameId");
  const endsAt = await server.room.storage.get<number>("endsAt");
  const appUrl = server.room.env.NEXT_PUBLIC_URL as string;
  const secret = server.room.env.PARTYKIT_SECRET as string;

  console.log("[PartyKit]", "gameEnd_phase_begin", { gameId });

  if (!gameId || !appUrl || !secret) {
    console.error("[PartyKit]", "gameEnd_missing_config", { gameId });
    return;
  }

  const roundupUrl = `${appUrl}/api/v1/internal/games/${gameId}/roundup`;

  try {
    console.log("[PartyKit]", "gameEnd_calling_roundup", { url: roundupUrl });

    const response = await fetch(roundupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
    });

    const result = await response.json();

    if (result.success) {
      server.broadcast({
        type: "game:end",
        gameId,
        prizePool: result.prizePool,
        winnersCount: result.winnersCount,
      });
      console.log("[PartyKit]", "gameEnd_roundup_success", { gameId });
    } else {
      console.error("[PartyKit]", "gameEnd_roundup_failed", {
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[PartyKit]", "gameEnd_roundup_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
