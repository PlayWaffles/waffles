/**
 * PartyKit Game Server
 *
 * Handles real-time game state, chat, and notifications via WebSocket.
 * Modular structure with handlers split into separate files.
 */

import type * as Party from "partykit/server";
import { jwtVerify } from "jose";
import type { Message, Entrant } from "../shared/protocol";
import { StoredChatMessage, AlarmPhase, CORS_HEADERS } from "./types";
import {
  handleInit,
  handleTicketPurchased,
  handleUpdateStats,
  handleUpdateGame,
  handleChatHistory,
  checkAuth,
} from "./handlers/http";
import {
  handleStartAlarm,
  handleGameEndAlarm,
  handleCountdownAlarm,
  handleLiveJoinAlarm,
} from "./handlers/alarms";
import {
  handleConnect,
  handleMessage,
  handleClose,
  handleError,
} from "./handlers/websocket";

// ==========================================
// GAME SERVER
// ==========================================

export default class GameServer implements Party.Server {
  readonly options: Party.ServerOptions = { hibernate: true };

  chatHistory: StoredChatMessage[] = [];
  entrants: Entrant[] = [];

  constructor(readonly room: Party.Room) {}

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  static async onBeforeConnect(
    request: Party.Request,
    lobby: Party.Lobby,
  ): Promise<Party.Request | Response> {
    try {
      const url = new URL(request.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return new Response("Unauthorized: No token", { status: 401 });
      }

      const secret = lobby.env.PARTYKIT_SECRET as string;
      if (!secret) {
        return new Response("Server configuration error", { status: 500 });
      }

      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { algorithms: ["HS256"] },
      );

      if (!payload.fid || !payload.username) {
        return new Response("Unauthorized: Invalid token", { status: 401 });
      }

      request.headers.set("X-User-Fid", String(payload.fid));
      request.headers.set("X-User-Username", String(payload.username));
      request.headers.set(
        "X-User-PfpUrl",
        payload.pfpUrl ? String(payload.pfpUrl) : "",
      );

      return request;
    } catch {
      return new Response("Unauthorized: Invalid token", { status: 401 });
    }
  }

  // ==========================================
  // HTTP API
  // ==========================================

  async onRequest(req: Party.Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const secret = this.room.env.PARTYKIT_SECRET as string;

    // Routes requiring auth
    const authRoutes = ["init", "ticket-purchased", "update-stats", "update-game", "chat-history"];
    if (authRoutes.includes(path || "") && !checkAuth(req, secret)) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    try {
      switch (path) {
        case "init":
          if (req.method !== "POST") {
            return Response.json(
              { error: "Method not allowed" },
              { status: 405, headers: CORS_HEADERS },
            );
          }
          return await handleInit(this, req);

        case "ticket-purchased":
          if (req.method !== "POST") {
            return Response.json(
              { error: "Method not allowed" },
              { status: 405, headers: CORS_HEADERS },
            );
          }
          return await handleTicketPurchased(this, req);

        case "update-game":
          if (req.method !== "POST") {
            return Response.json(
              { error: "Method not allowed" },
              { status: 405, headers: CORS_HEADERS },
            );
          }
          return await handleUpdateGame(this, req);

        case "update-stats":
          if (req.method !== "POST") {
            return Response.json(
              { error: "Method not allowed" },
              { status: 405, headers: CORS_HEADERS },
            );
          }
          return await handleUpdateStats(this, req);

        case "chat-history":
          if (req.method !== "GET") {
            return Response.json(
              { error: "Method not allowed" },
              { status: 405, headers: CORS_HEADERS },
            );
          }
          return await handleChatHistory(this);

        default:
          return Response.json(
            { error: "Not found" },
            { status: 404, headers: CORS_HEADERS },
          );
      }
    } catch (error) {
      console.error("[PartyKit]", "request_error", {
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json(
        { error: "Internal error" },
        { status: 500, headers: CORS_HEADERS },
      );
    }
  }

  // ==========================================
  // ALARM HANDLER
  // ==========================================

  async onAlarm() {
    const roomId = (await this.room.storage.get<string>("roomId")) || "unknown";
    const phase = await this.room.storage.get<AlarmPhase>("alarmPhase");
    const gameId = await this.room.storage.get<string>("gameId");

    console.log("[PartyKit]", "alarm_triggered", { gameId, phase });

    switch (phase) {
      // Countdown phases
      case "36h":
      case "24h":
      case "12h":
      case "6h":
      case "3h":
      case "1h":
      case "30min":
      case "15min":
      case "5min":
      case "1min":
        await handleCountdownAlarm(this, phase);
        break;
      case "live60m":
      case "live30m":
      case "live10m":
        await handleLiveJoinAlarm(this, phase);
        break;
      case "start":
        await handleStartAlarm(this, roomId);
        break;
      case "gameEnd":
        await handleGameEndAlarm(this, roomId);
        break;
      default:
        console.warn("[PartyKit]", "alarm_unknown_phase", { phase });
    }
  }

  // ==========================================
  // NOTIFICATIONS (used by alarm handlers)
  // ==========================================

  async sendNotifications(message: string, roomId?: string) {
    const gameId = await this.room.storage.get<string>("gameId");
    const appUrl = this.room.env.NEXT_PUBLIC_URL as string;
    const secret = this.room.env.PARTYKIT_SECRET as string;

    if (!appUrl || !secret || !gameId) {
      console.warn("[PartyKit]", "notify_skipped_missing_config", { gameId });
      return;
    }

    const notifyUrl = `${appUrl}/api/v1/internal/games/${gameId}/notify`;

    try {
      const response = await fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ message }),
      });

      if (response.ok) {
        console.log("[PartyKit]", "notify_sent", { gameId, message });
      } else {
        console.warn("[PartyKit]", "notify_failed", {
          status: response.status,
        });
      }
    } catch (error) {
      console.error("[PartyKit]", "notify_error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  async onStart() {
    await this.room.storage.put("roomId", this.room.id);

    console.log("[PartyKit]", "room_starting", { roomId: this.room.id });

    // Restore persisted state
    // Load chat messages from individual keys (new format)
    const chatMessages = await this.room.storage.list<StoredChatMessage>({
      prefix: "chat:",
    });

    if (chatMessages.size > 0) {
      // Convert map to sorted array (keys are chat:{timestamp}:{id})
      this.chatHistory = Array.from(chatMessages.values())
        .sort((a, b) => a.ts - b.ts)
        .slice(-100); // Keep last 100 for in-memory sync
    } else {
      // Fallback: try legacy format for backwards compatibility
      this.chatHistory =
        (await this.room.storage.get<StoredChatMessage[]>("chatHistory")) || [];
    }

    this.entrants = (await this.room.storage.get<Entrant[]>("entrants")) || [];

    const alarmPhase = await this.room.storage.get<AlarmPhase>("alarmPhase");
    const gameId = await this.room.storage.get<string>("gameId");

    console.log("[PartyKit]", "room_state_restored", {
      gameId,
      alarmPhase,
      chatHistoryCount: this.chatHistory.length,
      entrantsCount: this.entrants.length,
    });
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    handleConnect(this, conn, ctx);
  }

  async onMessage(message: string, sender: Party.Connection) {
    await handleMessage(this, message, sender);
  }

  onClose(conn: Party.Connection) {
    handleClose(this, conn);
  }

  onError(conn: Party.Connection, error: Error) {
    handleError(conn, error);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  safeRoomId(): string {
    try {
      return this.room.id;
    } catch {
      return "unknown";
    }
  }

  getOnlineCount(): number {
    return [...this.room.getConnections()].length;
  }

  broadcast(msg: Message, exclude: string[] = []) {
    this.room.broadcast(JSON.stringify(msg), exclude);
  }
}

GameServer satisfies Party.Worker;
