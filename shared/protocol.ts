/**
 * PartyKit Protocol - Shared Message Types
 *
 * Single source of truth for all WebSocket messages.
 * Imported by both party/main.ts and client-side code.
 */

// ==========================================
// HELPER TYPES
// ==========================================

export interface ChatItem {
  id: string;
  username: string;
  pfp: string | null;
  text: string;
  ts: number;
}

export interface Player {
  fid: number;
  username: string;
  pfp: string | null;
}

export interface Entrant {
  username: string;
  pfpUrl: string | null;
  timestamp: number;
}

export interface QuestionAnswerer extends Entrant {
  correct: boolean | null;
}

// ==========================================
// MESSAGE TYPES
// ==========================================

export type Message =
  // === SYNC (Server → Client on connect) ===
  | { type: "sync"; connected: number; chat: ChatItem[]; entrants: Entrant[] }

  // === PRESENCE (Server → Clients) ===
  | {
      type: "entrant:new";
      username: string;
      pfpUrl: string | null;
      timestamp: number;
    }
  | { type: "left"; username: string }
  | { type: "connected"; count: number }

  // === CHAT (Bidirectional) ===
  | { type: "chat"; text: string } // Client → Server (no id/username, server adds)
  | {
      type: "chat:new";
      id: string;
      username: string;
      pfp: string | null;
      text: string;
      ts: number;
    } // Server → Clients

  // === GAME LIFECYCLE (Server → Clients) ===
  | { type: "game:starting"; in: number } // seconds until start
  | { type: "game:live" } // game is now playable
  | {
      type: "game:end";
      gameId: string;
      prizePool?: number;
      winnersCount?: number;
    } // game over, redirect to results

  // === STATS (Server → Clients) ===
  | { type: "stats"; prizePool: number; playerCount: number }

  // === SOCIAL (Bidirectional) ===
  | {
      type: "answered";
      questionIndex: number;
      questionId?: string;
      username: string;
      pfp: string | null;
      ts: number;
      correct: boolean | null;
    }
  | { type: "cheer" }

  // === PLAYER ACTIONS (Client → Server) ===
  | { type: "submit"; q: number; questionId?: string; a: number; ms: number; correct?: boolean | null }; // questionIndex, answerIndex, timeMs

// ==========================================
// TYPE GUARDS
// ==========================================

export function isMessage(obj: unknown): obj is Message {
  return typeof obj === "object" && obj !== null && "type" in obj;
}

// Client-sendable message types
export type ClientMessage = Extract<
  Message,
  { type: "chat" } | { type: "submit" } | { type: "cheer" }
>;

// Server-sendable message types
export type ServerMessage = Exclude<Message, ClientMessage>;
