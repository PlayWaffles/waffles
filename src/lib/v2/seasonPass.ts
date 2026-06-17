/**
 * Season Pass service — per-user, per-season claim tracking. Tier definitions +
 * reward amounts live in seasonPassTiers.ts (shared with the screen); pass level
 * and progress derive from the player's XP. Claiming a free-track reward credits
 * its tickets/XP once and records the claim so it can't be re-claimed.
 */
import { prisma } from "@/lib/db";
import { trackServerEvent } from "@/lib/server-analytics";
import { TicketLedgerReason } from "@prisma";
import { adjustTickets } from "./playerState";
import { currentSeason } from "./leagues";
import {
  SEASON_PASS_TIERS,
  SEASON_PASS_XP_PER_TIER,
  seasonPassLevel,
} from "./seasonPassTiers";

export type V2SeasonPass = {
  season: string;
  level: number;
  xp: number;
  xpPerTier: number;
  claimed: { tier: number; premium: boolean }[];
};

export async function loadSeasonPass(userId: string): Promise<V2SeasonPass> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { xp: true },
  });
  const season = currentSeason();
  const claims = await prisma.seasonPassClaim.findMany({
    where: { userId, season },
    select: { tier: true, premium: true },
  });
  return {
    season,
    level: seasonPassLevel(user.xp),
    xp: user.xp,
    xpPerTier: SEASON_PASS_XP_PER_TIER,
    claimed: claims.map((c) => ({ tier: c.tier, premium: c.premium })),
  };
}

export type SeasonClaimResult = {
  ok: boolean;
  reason?: "locked" | "already" | "premium" | "invalid";
  tickets: number | null;
  xp: number | null;
};

/**
 * Claim a free-track season reward for a 1-based tier the player has unlocked.
 * Premium-track rewards are VIP (purchased in the Shop), so they are rejected
 * here. Idempotent per (season, tier, premium).
 */
export async function claimSeasonReward(
  userId: string,
  tier: number,
  premium: boolean,
): Promise<SeasonClaimResult> {
  if (premium) {
    await trackServerEvent({
      name: "season_reward_claim_authoritative",
      userId,
      properties: {
        result: "premium_blocked",
        tier,
        premium,
      },
    });
    return { ok: false, reason: "premium", tickets: null, xp: null };
  }
  const idx = tier - 1;
  if (idx < 0 || idx >= SEASON_PASS_TIERS.length) {
    await trackServerEvent({
      name: "season_reward_claim_authoritative",
      userId,
      properties: {
        result: "invalid",
        tier,
        premium,
      },
    });
    return { ok: false, reason: "invalid", tickets: null, xp: null };
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { xp: true },
  });
  if (tier > seasonPassLevel(user.xp)) {
    await trackServerEvent({
      name: "season_reward_claim_authoritative",
      userId,
      properties: {
        result: "locked",
        tier,
        premium,
        season_pass_level: seasonPassLevel(user.xp),
      },
    });
    return { ok: false, reason: "locked", tickets: null, xp: null };
  }

  const season = currentSeason();
  const reward = SEASON_PASS_TIERS[idx].free;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.seasonPassClaim.findUnique({
      where: { userId_season_tier_premium: { userId, season, tier, premium: false } },
      select: { id: true },
    });
    if (existing) {
      await trackServerEvent({
        name: "season_reward_claim_authoritative",
        userId,
        tx,
        properties: {
          result: "already_claimed",
          season,
          tier,
          premium: false,
          reward_type: reward.type,
          reward_amount: reward.amount,
        },
      });
      return { ok: false, reason: "already" as const, tickets: null, xp: null };
    }

    await tx.seasonPassClaim.create({ data: { userId, season, tier, premium: false } });

    let tickets: number | null = null;
    let xp: number | null = null;
    if (reward.type === "ticket" && reward.amount > 0) {
      tickets = await adjustTickets(userId, reward.amount, TicketLedgerReason.SEASON_PASS, {
        refId: `${season}:t${tier}`,
        tx,
      });
    } else if (reward.type === "xp" && reward.amount > 0) {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: reward.amount } },
        select: { xp: true },
      });
      xp = updated.xp;
    }
    // cosmetic rewards: claim recorded, no currency credited (unlock only).
    await trackServerEvent({
      name: "season_reward_claim_authoritative",
      userId,
      tx,
      properties: {
        result: "claimed",
        season,
        tier,
        premium: false,
        reward_type: reward.type,
        reward_amount: reward.amount,
        tickets_after: tickets,
        xp_after: xp,
      },
    });
    return { ok: true, tickets, xp };
  });
}
