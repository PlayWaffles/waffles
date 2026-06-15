"use server";

/**
 * Server actions for the ported v2 client (`ProtoProvider`). Each resolves the
 * current authenticated user and delegates to the player-state service.
 *
 * When there is no authenticated user (e.g. the `/v2` preview route outside the
 * miniapp runtime), reads return `null` and mutations no-op — the client keeps
 * its local/optimistic state so the screens still render and demo cleanly.
 */
import { getCurrentUser } from "@/lib/auth";
import {
  adjustTickets,
  advanceLevel,
  loadPlayerState,
  loseLife,
  recordBadge,
  refillLives,
  resolveWinning,
  setAnnouncementDismissed,
  setAnnouncementRead,
  setAvatar,
  setUsername,
  type V2PlayerState,
  type V2Track,
} from "@/lib/v2/playerState";
import { enterRound, roundStandings, submitRoundScore, type RoundBoard } from "@/lib/v2/rounds";
import { buyBundle, buyStreakFreeze, claimDailyReward, consumePowerUp, loadPowerUps, purchaseShopItem, type DailyClaimResult, type PurchaseResult } from "@/lib/v2/economy";
import { PowerUpKind } from "@prisma";
import { loadMissions, recordMissionProgress, type V2Mission } from "@/lib/v2/missions";
import { loadLeague, type V2League } from "@/lib/v2/leagues";
import { TicketLedgerReason } from "@prisma";

export async function v2LoadMissions(): Promise<V2Mission[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadMissions(user.id);
}

export async function v2RecordMissionProgress(slug: string, n = 1): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await recordMissionProgress(user.id, slug, n);
}

export async function v2LoadLeague(): Promise<V2League | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadLeague(user.id);
}

export async function loadV2State(): Promise<V2PlayerState | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadPlayerState(user.id);
}

export async function v2EnterRound(
  roundId: number,
  bonus: boolean,
): Promise<{ entryId: string; tickets: number | null; alreadyEntered: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return enterRound(user.id, roundId, bonus);
}

export async function v2SubmitRoundScore(roundId: number, score: number): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await submitRoundScore(user.id, roundId, score);
}

/** Real leaderboard: standings of the latest round with entries (+ your row). */
export async function v2LoadLeaderboard(): Promise<RoundBoard | null> {
  const user = await getCurrentUser();
  return roundStandings({ userId: user?.id, limit: 50 });
}

/** Real standings for a specific round — drives results/home read-back + the
 *  in-quiz "people answering" presence strip. */
export async function v2LoadRoundBoard(roundId: number): Promise<RoundBoard | null> {
  const user = await getCurrentUser();
  return roundStandings({ roundId, userId: user?.id, limit: 10 });
}

export async function v2ClaimDaily(): Promise<DailyClaimResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return claimDailyReward(user.id);
}

export async function v2Purchase(slug: string): Promise<PurchaseResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return purchaseShopItem(user.id, slug);
}

export async function v2AdvanceLevel(
  track: V2Track,
  xpGain: number,
): Promise<{ level: number; ticketAwarded: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return advanceLevel(user.id, track, xpGain);
}

export async function v2LoseLife(): Promise<{ lives: number; nextLifeAt: number | null } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loseLife(user.id);
}

export async function v2RefillLives(): Promise<{ lives: number; tickets: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return refillLives(user.id);
}

export async function v2ResolveWinning(
  winningId: string,
  mode: "claim" | "convert",
): Promise<{ tickets: number | null } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return resolveWinning(user.id, winningId, mode);
}

/** Generic ticket adjustment for client-side economy events (e.g. tournament
 *  entry charge, daily reward). Reason is validated against the enum. */
export async function v2AdjustTickets(
  delta: number,
  reason: keyof typeof TicketLedgerReason,
  refId?: string,
): Promise<{ tickets: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const tickets = await adjustTickets(user.id, delta, TicketLedgerReason[reason], { refId });
  return { tickets };
}

export async function v2SetAnnouncementsRead(ids: string[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await setAnnouncementRead(user.id, ids);
}

export async function v2DismissAnnouncement(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await setAnnouncementDismissed(user.id, id);
}

export async function v2SetUsername(username: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await setUsername(user.id, username);
}

export async function v2SetAvatar(avatarId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await setAvatar(user.id, avatarId);
}

export async function v2RecordBadge(badgeId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await recordBadge(user.id, badgeId);
}

export async function v2BuyStreakFreeze(): Promise<{ tickets: number; freezes: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return buyStreakFreeze(user.id);
}

export async function v2BuyBundle(slug: string, txHash?: string): Promise<{ tickets: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return buyBundle(user.id, slug, txHash);
}

export type V2PowerUps = Record<keyof typeof PowerUpKind, number>;

export async function v2LoadPowerUps(): Promise<V2PowerUps | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadPowerUps(user.id) as Promise<V2PowerUps>;
}

export async function v2ConsumePowerUp(
  kind: keyof typeof PowerUpKind,
): Promise<{ ok: boolean; remaining: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return consumePowerUp(user.id, PowerUpKind[kind]);
}
