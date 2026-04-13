// HTTP API handlers for PartyKit server

import type * as Party from "partykit/server";
import { CORS_HEADERS, type AlarmPhase, type StoredChatMessage } from "../types";
import type { Entrant } from "../../shared/protocol";
import {
  handleStartAlarm,
  getFirstCountdownPhase,
  getAlarmTimeForPhase,
  scheduleNextLiveOrEndAlarm,
} from "./alarms";

interface GameServer {
  room: Party.Room;
  entrants: Entrant[];
  chatHistory: StoredChatMessage[];
  getOnlineCount(): number;
  broadcast(msg: unknown): void;
}

// Common auth check
function checkAuth(req: Party.Request, secret: string): boolean {
  const authHeader = req.headers.get("Authorization");
  return authHeader === `Bearer ${secret}`;
}

// Init endpoint - called when admin creates game
export async function handleInit(
  server: GameServer,
  req: Party.Request,
): Promise<Response> {
  const body = (await req.json()) as {
    gameId: string;
    startsAt: string;
    endsAt: string;
    gameNumber?: number;
  };

  const startsAt = new Date(body.startsAt).getTime();
  const endsAt = new Date(body.endsAt).getTime();
  const now = Date.now();

  console.log("[PartyKit]", "init_received", {
    gameId: body.gameId,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  });

  // Store game data
  await server.room.storage.put("gameId", body.gameId);
  await server.room.storage.put("startsAt", startsAt);
  await server.room.storage.put("endsAt", endsAt);
  if (body.gameNumber) {
    await server.room.storage.put("gameNumber", body.gameNumber);
  }

  // Determine first alarm phase based on time until start
  const firstPhase = getFirstCountdownPhase(startsAt, now);

  if (firstPhase) {
    const alarmTime = getAlarmTimeForPhase(firstPhase, startsAt, endsAt);
    if (alarmTime && alarmTime > now) {
      await server.room.storage.put("alarmPhase", firstPhase);
      await server.room.storage.setAlarm(alarmTime);
      console.log("[PartyKit]", "init_alarm_scheduled", {
        phase: firstPhase,
        at: new Date(alarmTime).toISOString(),
      });
    }
  } else {
    console.log("[PartyKit]", "init_immediate_start");
    // Game already started or about to - trigger start handler
    if (endsAt > now) {
      await handleStartAlarm(server as any, server.room.id);
    }
  }

  return Response.json(
    { success: true, gameId: body.gameId },
    { headers: CORS_HEADERS },
  );
}

// Ticket purchased endpoint
export async function handleTicketPurchased(
  server: GameServer,
  req: Party.Request,
): Promise<Response> {
  const body = (await req.json()) as {
    username: string;
    pfpUrl: string | null;
    prizePool: number;
    playerCount: number;
  };

  const entrant: Entrant = {
    username: body.username,
    pfpUrl: body.pfpUrl,
    timestamp: Date.now(),
  };

  server.entrants = [
    entrant,
    ...server.entrants.filter((e) => e.username !== entrant.username),
  ].slice(0, 20);

  await server.room.storage.put("entrants", server.entrants);

  server.broadcast({
    type: "stats",
    prizePool: body.prizePool,
    playerCount: body.playerCount,
  });
  server.broadcast({
    type: "entrant:new",
    username: entrant.username,
    pfpUrl: entrant.pfpUrl,
    timestamp: entrant.timestamp,
  });

  console.log("[PartyKit]", "ticket_purchased_broadcasted", {
    username: entrant.username,
    prizePool: body.prizePool,
    playerCount: body.playerCount,
  });

  return Response.json({ success: true }, { headers: CORS_HEADERS });
}

export async function handleUpdateStats(
  server: GameServer,
  req: Party.Request,
): Promise<Response> {
  const body = (await req.json()) as {
    prizePool: number;
    playerCount: number;
  };

  server.broadcast({
    type: "stats",
    prizePool: body.prizePool,
    playerCount: body.playerCount,
  });

  console.log("[PartyKit]", "stats_updated_broadcasted", {
    prizePool: body.prizePool,
    playerCount: body.playerCount,
  });

  return Response.json({ success: true }, { headers: CORS_HEADERS });
}

// Update game endpoint - called when admin updates game
export async function handleUpdateGame(
  server: GameServer,
  req: Party.Request,
): Promise<Response> {
  const body = (await req.json()) as {
    startsAt: string;
    endsAt: string;
  };

  const startsAt = new Date(body.startsAt).getTime();
  const endsAt = new Date(body.endsAt).getTime();
  const now = Date.now();
  const gameId = await server.room.storage.get<string>("gameId");

  console.log("[PartyKit]", "update_timing_received", {
    gameId,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  });

  await server.room.storage.put("startsAt", startsAt);
  await server.room.storage.put("endsAt", endsAt);

  // Re-schedule alarms based on new timing
  const firstPhase = getFirstCountdownPhase(startsAt, now);
  if (firstPhase) {
    const alarmTime = getAlarmTimeForPhase(firstPhase, startsAt, endsAt);
    if (alarmTime && alarmTime > now) {
      await server.room.storage.put("alarmPhase", firstPhase);
      await server.room.storage.setAlarm(alarmTime);
      console.log("[PartyKit]", "update_alarm_rescheduled", {
        phase: firstPhase,
      });
    }
  } else if (endsAt > now) {
    const nextPhase = await scheduleNextLiveOrEndAlarm(server as any, endsAt, now);
    if (nextPhase) {
      console.log("[PartyKit]", "update_alarm_rescheduled", {
        phase: nextPhase,
      });
    }
  }

  return Response.json({ success: true }, { headers: CORS_HEADERS });
}

// Chat history endpoint - used by admin analytics
export async function handleChatHistory(server: GameServer): Promise<Response> {
  const storedMessages = await server.room.storage.list<StoredChatMessage>({
    prefix: "chat:",
  });

  const messages = storedMessages.size > 0
    ? Array.from(storedMessages.values()).sort((a, b) => a.ts - b.ts)
    : server.chatHistory;

  return Response.json(
    {
      messages,
      count: messages.length,
    },
    { headers: CORS_HEADERS },
  );
}

export { checkAuth };
