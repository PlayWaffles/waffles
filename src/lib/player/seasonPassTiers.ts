/**
 * Season Pass tier definitions — pure data, no DB. Shared by the Compete screen
 * (renders the reward track) and the season-pass service (credits the reward on
 * claim), so the displayed reward and the credited amount can never drift.
 *
 * Pass level + progress derive from the player's XP: every SEASON_PASS_XP_PER_TIER
 * XP advances one pass tier. Free-track rewards are claimable once per tier per
 * season; premium-track rewards are VIP (routed to the Shop).
 */
export type SeasonRewardType = "xp" | "ticket" | "cosmetic";
export type SeasonReward = { type: SeasonRewardType; label: string; amount: number };

export const SEASON_PASS_XP_PER_TIER = 500;
export const SEASON_PASS_TIER_COUNT = 12;

// Twelve tiers of free + premium rewards. `amount` is what the server credits
// (tickets or XP); cosmetics carry amount 0 (an unlock, not a currency grant).
export const SEASON_PASS_TIERS: { free: SeasonReward; premium: SeasonReward }[] = [
  { free: { type: "xp", label: "+50 XP", amount: 50 }, premium: { type: "ticket", label: "×2 Tickets", amount: 2 } },
  { free: { type: "ticket", label: "×1 Ticket", amount: 1 }, premium: { type: "cosmetic", label: "Frame", amount: 0 } },
  { free: { type: "xp", label: "+75 XP", amount: 75 }, premium: { type: "ticket", label: "×3 Tickets", amount: 3 } },
  { free: { type: "cosmetic", label: "Emote", amount: 0 }, premium: { type: "cosmetic", label: "Avatar", amount: 0 } },
  { free: { type: "xp", label: "+50 XP", amount: 50 }, premium: { type: "ticket", label: "×2 Tickets", amount: 2 } },
  { free: { type: "ticket", label: "×1 Ticket", amount: 1 }, premium: { type: "cosmetic", label: "Frame", amount: 0 } },
  { free: { type: "xp", label: "+75 XP", amount: 75 }, premium: { type: "ticket", label: "×3 Tickets", amount: 3 } },
  { free: { type: "cosmetic", label: "Emote", amount: 0 }, premium: { type: "cosmetic", label: "Avatar", amount: 0 } },
  { free: { type: "xp", label: "+50 XP", amount: 50 }, premium: { type: "ticket", label: "×2 Tickets", amount: 2 } },
  { free: { type: "ticket", label: "×1 Ticket", amount: 1 }, premium: { type: "cosmetic", label: "Frame", amount: 0 } },
  { free: { type: "xp", label: "+75 XP", amount: 75 }, premium: { type: "ticket", label: "×3 Tickets", amount: 3 } },
  { free: { type: "cosmetic", label: "Emote", amount: 0 }, premium: { type: "cosmetic", label: "Avatar", amount: 0 } },
];

/** 1-based pass tier the player has reached (capped at the last tier). */
export function seasonPassLevel(xp: number): number {
  return Math.max(1, Math.min(SEASON_PASS_TIER_COUNT, Math.floor(xp / SEASON_PASS_XP_PER_TIER) + 1));
}

/** XP into the current tier and the per-tier threshold — drives the progress bar. */
export function seasonPassProgress(xp: number): { level: number; into: number; next: number } {
  return { level: seasonPassLevel(xp), into: xp % SEASON_PASS_XP_PER_TIER, next: SEASON_PASS_XP_PER_TIER };
}
