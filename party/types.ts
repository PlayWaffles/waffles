// Party server types

export interface StoredChatMessage {
  id: string;
  text: string;
  username: string;
  pfp: string | null;
  ts: number;
}

export type AlarmPhase =
  // Pre-game countdown notifications
  | "24h"
  | "12h"
  | "6h"
  | "3h"
  | "1h"
  | "30min"
  | "15min"
  | "5min"
  | "1min"
  // Live join reminders
  | "live60m"
  | "live30m"
  | "live10m"
  // Game lifecycle
  | "start" // Game goes live
  | "gameEnd"; // Game ends, trigger settlement

// CORS headers for HTTP responses
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};
