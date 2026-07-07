// ==========================================
// LEADERBOARD (Leaderboard Page)
// ==========================================

export interface LeaderboardEntry {
  id: string | number;
  userId?: string | number;
  fid?: number | null;
  wallet?: string | null;
  rank: number;
  username: string | null;
  prize: number; // USDC prize amount
  score?: number; // Points scored in the game
  pfpUrl: string | null;
}

// ==========================================
// GAME PHASE (re-exported from timing authority)
// ==========================================

export type { GamePhase, GameTiming } from "@/lib/game/timing";
export { getGamePhase, getPhase } from "@/lib/game/timing";
