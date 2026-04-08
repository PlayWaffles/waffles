// WebSocket handlers for PartyKit server

import type * as Party from "partykit/server";
import type { Message, ChatItem, Player, Entrant } from "../../shared/protocol";
import type { StoredChatMessage } from "../types";

interface GameServer {
  room: Party.Room;
  chatHistory: StoredChatMessage[];
  entrants: Entrant[];
  getOnlineCount(): number;
  broadcast(msg: Message, exclude?: string[]): void;
}

/**
 * Handle new connection - send sync data
 */
export function handleConnect(
  server: GameServer,
  conn: Party.Connection,
  ctx: Party.ConnectionContext,
): void {
  const fid = Number(ctx.request.headers.get("X-User-Fid"));
  const username = ctx.request.headers.get("X-User-Username") || "Unknown";
  const pfp = ctx.request.headers.get("X-User-PfpUrl") || null;

  const player: Player = { fid, username, pfp };
  conn.setState(player);

  console.log("[PartyKit]", "client_connected", {
    fid,
    username,
    totalConnections: server.getOnlineCount(),
  });

  // Send sync to new client
  const chat: ChatItem[] = server.chatHistory.slice(-50).map((msg) => ({
    id: msg.id,
    username: msg.username,
    pfp: msg.pfp,
    text: msg.text,
    ts: msg.ts,
  }));

  conn.send(
    JSON.stringify({
      type: "sync",
      connected: server.getOnlineCount(),
      chat,
      entrants: server.entrants,
    } as Message),
  );

  // Update connected count for all
  server.broadcast({ type: "connected", count: server.getOnlineCount() });
}

/**
 * Handle incoming message
 */
export async function handleMessage(
  server: GameServer,
  message: string,
  sender: Party.Connection,
): Promise<void> {
  try {
    const msg = JSON.parse(message) as Message;
    const player = sender.state as Player;
    if (!player) return;

    switch (msg.type) {
      case "chat":
        await handleChat(server, player, msg.text);
        break;

      case "submit":
        server.broadcast(
          {
            type: "answered",
            questionIndex: msg.q,
            questionId: msg.questionId,
            username: player.username,
            pfp: player.pfp,
            ts: Date.now(),
            correct: msg.correct ?? null,
          },
          [sender.id],
        );
        break;

      case "cheer":
        server.room.broadcast(JSON.stringify({ type: "cheer" } as Message), [
          sender.id,
        ]);
        break;
    }
  } catch {
    // Ignore parse errors
  }
}

/**
 * Handle chat message
 *
 * Messages are stored individually by key (chat:{timestamp}:{id}) for:
 * - Unlimited storage (no 128KB value limit)
 * - Full chat history retention for analytics
 * - In-memory cache still limited to 100 for performance
 */
async function handleChat(
  server: GameServer,
  player: Player,
  text: string,
): Promise<void> {
  const chatMsg: StoredChatMessage = {
    id: crypto.randomUUID(),
    text,
    username: player.username,
    pfp: player.pfp,
    ts: Date.now(),
  };

  // Keep in-memory cache limited for sync performance
  server.chatHistory.push(chatMsg);
  if (server.chatHistory.length > 100) server.chatHistory.shift();

  // Store individual message by key for unlimited persistence
  // Key format: chat:{timestamp}:{id} for natural ordering
  await server.room.storage.put(`chat:${chatMsg.ts}:${chatMsg.id}`, chatMsg);

  server.broadcast({
    type: "chat:new",
    id: chatMsg.id,
    username: chatMsg.username,
    pfp: chatMsg.pfp,
    text: chatMsg.text,
    ts: chatMsg.ts,
  });
}

/**
 * Handle disconnection
 */
export function handleClose(server: GameServer, conn: Party.Connection): void {
  const player = conn.state as Player;
  if (player) {
    console.log("[PartyKit]", "client_disconnected", {
      fid: player.fid,
      username: player.username,
      remainingConnections: server.getOnlineCount(),
    });
    server.broadcast({ type: "left", username: player.username });
    server.broadcast({ type: "connected", count: server.getOnlineCount() });
  }
}

/**
 * Handle connection error
 */
export function handleError(conn: Party.Connection, error: Error): void {
  const player = conn.state as Player | undefined;
  console.error("[PartyKit]", "connection_error", {
    fid: player?.fid,
    username: player?.username,
    error: error.message,
  });
}
