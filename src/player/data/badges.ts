import { ASSETS } from "../shared";

// Achievements / badges.
//
// Badges are *derived*, not stored: each is a pure predicate over a small
// `BadgeStats` view of the player. Earned = `current(stats) >= goal`. This needs
// no extra persistence and can never drift from the real stats — and it's
// migration-safe: when game state moves server-side, the same predicates run on
// server-provided stats (or the server simply returns the earned id list). The
// catalog below is just static content.

export type BadgeStats = {
  level: number;
  streak: number;
  tickets: number;
  // Tournament prizes ever won (each Top-100 finish that paid out).
  prizesWon: number;
  // Best (lowest) finishing rank the player has ever achieved, or null.
  bestRank: number | null;
  // Prizes resolved as real USDT (claimed, not converted to tickets).
  prizesClaimed: number;
};

export type Badge = {
  id: string;
  name: string;
  desc: string;
  icon: string; // resolved asset path
  accent: string;
  goal: number;
  // Current value toward `goal` for the given stats (clamped against goal for
  // the progress %; raw value is fine to exceed goal).
  current: (s: BadgeStats) => number;
};

const rankAtMost = (s: BadgeStats, n: number) => (s.bestRank != null && s.bestRank <= n ? 1 : 0);

export const BADGES: Badge[] = [
  { id: "rookie", name: "Rookie", desc: "Reach level 10.", icon: ASSETS.medalApprentice, accent: "#cd7f32", goal: 10, current: (s) => s.level },
  { id: "veteran", name: "Veteran", desc: "Reach level 25.", icon: ASSETS.medalSilver, accent: "#bfc7d0", goal: 25, current: (s) => s.level },
  { id: "legend", name: "Legend", desc: "Reach level 50.", icon: ASSETS.medalMaster, accent: "var(--maple-500)", goal: 50, current: (s) => s.level },
  { id: "on-fire", name: "On Fire", desc: "Keep a 7-day streak.", icon: ASSETS.flame, accent: "var(--berry)", goal: 7, current: (s) => s.streak },
  { id: "unstoppable", name: "Unstoppable", desc: "Keep a 30-day streak.", icon: ASSETS.flame, accent: "var(--live-red)", goal: 30, current: (s) => s.streak },
  { id: "in-the-money", name: "In the Money", desc: "Win your first tournament prize.", icon: ASSETS.ticket, accent: "var(--leaf)", goal: 1, current: (s) => s.prizesWon },
  { id: "sharpshooter", name: "Sharpshooter", desc: "Finish in the Top 10 of a tournament.", icon: ASSETS.trophy, accent: "var(--maple-500)", goal: 1, current: (s) => rankAtMost(s, 10) },
  { id: "champion", name: "Champion", desc: "Finish 1st in a tournament.", icon: ASSETS.trophy, accent: "#FFD23F", goal: 1, current: (s) => rankAtMost(s, 1) },
  { id: "high-roller", name: "High Roller", desc: "Hold 10 tickets at once.", icon: ASSETS.coin, accent: "var(--maple-500)", goal: 10, current: (s) => s.tickets },
  { id: "collector", name: "Collector", desc: "Claim a prize as USDT.", icon: ASSETS.vipStar, accent: "var(--berry)", goal: 1, current: (s) => s.prizesClaimed },
];

export const badgeProgress = (b: Badge, s: BadgeStats): number => Math.min(1, b.current(s) / b.goal);
export const isBadgeEarned = (b: Badge, s: BadgeStats): boolean => b.current(s) >= b.goal;
export const earnedBadgeIds = (s: BadgeStats): string[] => BADGES.filter((b) => isBadgeEarned(b, s)).map((b) => b.id);

// Minimal slice of game state the stats are derived from. Declared structurally
// (not as the full Proto) so this data module stays decoupled — the same shape
// is trivially filled from server data after the state migration.
export type BadgeStatsSource = {
  level: number;
  streak: number;
  tickets: number;
  lastTournamentRank: number | null;
  winnings: ReadonlyArray<{ rank: number; status: string }>;
};

export const deriveBadgeStats = (p: BadgeStatsSource): BadgeStats => ({
  level: p.level,
  streak: p.streak,
  tickets: p.tickets,
  prizesWon: p.winnings.length,
  bestRank: p.winnings.reduce<number | null>(
    (m, w) => (m == null ? w.rank : Math.min(m, w.rank)),
    p.lastTournamentRank ?? null,
  ),
  prizesClaimed: p.winnings.filter((w) => w.status === "claimed").length,
});

export const badgeById = (id: string): Badge | undefined => BADGES.find((b) => b.id === id);
