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

/**
 * Countdown phases in chronological order (earliest to latest)
 * Each phase sends a notification and schedules the next
 */
const COUNTDOWN_PHASES: CountdownPhase[] = [
  {
    phase: "24h",
    offsetMs: 24 * 60 * 60 * 1000,
    nextPhase: "12h",
    title: "24 Hours Left ⏳",
    body: "Game starts tomorrow. Secure your spot now.",
  },
  {
    phase: "12h",
    offsetMs: 12 * 60 * 60 * 1000,
    nextPhase: "6h",
    title: "12 Hours to Go 🌗",
    body: "Tickets are selling fast. Don't get left behind!",
  },
  {
    phase: "6h",
    offsetMs: 6 * 60 * 60 * 1000,
    nextPhase: "3h",
    title: "6 Hours to Go 👀",
    body: "Waffles is getting close. Claim your spot before the rush.",
  },
  {
    phase: "3h",
    offsetMs: 3 * 60 * 60 * 1000,
    nextPhase: "1h",
    title: "3 Hours Warning ⚠️",
    body: "The window is closing. Lock in your ticket!",
  },
  {
    phase: "1h",
    offsetMs: 1 * 60 * 60 * 1000,
    nextPhase: "30min",
    title: "1 Hour Remaining 🚨",
    body: "This is your last chance to join. Hurry!",
  },
  {
    phase: "30min",
    offsetMs: 30 * 60 * 1000,
    nextPhase: "15min",
    title: "30 Minutes Left ⏰",
    body: "Half an hour to go. Get in now and get ready.",
  },
  {
    phase: "15min",
    offsetMs: 15 * 60 * 1000,
    nextPhase: "5min",
    title: "15 Minutes Left ⚡",
    body: "Final warning. Waffles starts soon.",
  },
  {
    phase: "5min",
    offsetMs: 5 * 60 * 1000,
    nextPhase: "1min",
    title: "Starting in 5 Minutes! 🧨",
    body: "Game on! Get your ticket immediately or miss out.",
  },
  {
    phase: "1min",
    offsetMs: 1 * 60 * 1000,
    nextPhase: "start",
    title: "1 Minute Left 🚀",
    body: "This is it. Waffles is about to begin.",
  },
];

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
 * Get alarm time for a phase
 */
export function getAlarmTimeForPhase(
  phase: AlarmPhase,
  startsAt: number,
  endsAt: number,
): number | null {
  const config = COUNTDOWN_PHASES.find((p) => p.phase === phase);
  if (config) return startsAt - config.offsetMs;
  if (phase === "start") return startsAt;
  if (phase === "gameEnd") return endsAt;
  return null;
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

  // Schedule game end alarm
  await server.room.storage.put("alarmPhase", "gameEnd" as AlarmPhase);
  await server.room.storage.setAlarm(endsAt);

  await server.sendNotifications("The game has started! 🚀", roomId);
  server.broadcast({ type: "game:live" });

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
