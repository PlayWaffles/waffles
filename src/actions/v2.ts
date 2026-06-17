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
import { getRoundClientQuestions, getLevelClientQuestions, type ClientRoundQuestion, type LevelTrack } from "@/lib/v2/roundQuestions";
import {
  confirmTournamentClaim,
  currentTournamentGame,
  enterTournamentOnChain,
  getTournamentClaim,
  getTournamentClientQuestions,
  latestTournamentStandings,
  loadTournamentClaims,
  submitTournamentAnswers,
  tournamentStandings,
  TOURNAMENT_STANDARD_FEE_USDC,
  type EnterResult,
  type TournamentBoard,
  type TournamentClaim,
  type TournamentClaimItem,
  type TournamentGame,
} from "@/lib/v2/tournamentGames";
import { getMigrationNotice, dismissMigrationNotice } from "@/lib/v2/migrationNotice";
import type { RoundAnswer } from "@/lib/v2/scoring";
import { buyBundle, buyStreakFreeze, claimDailyReward, consumePowerUp, loadPowerUps, purchaseShopItem, type DailyClaimResult, type PurchaseResult } from "@/lib/v2/economy";
import { PowerUpKind } from "@prisma";
import { loadMissions, recordMissionProgress, type V2Mission } from "@/lib/v2/missions";
import { loadLeague, type V2League } from "@/lib/v2/leagues";
import { loadPartnerOffers, claimPartnerOffer, type V2PartnerOffer, type PartnerClaimResult } from "@/lib/v2/partnerOffers";
import { loadSeasonPass, claimSeasonReward, type V2SeasonPass, type SeasonClaimResult } from "@/lib/v2/seasonPass";
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

/** Sponsored partner offers (Missions → Partners tab), with per-user claim state. */
export async function v2LoadPartnerOffers(): Promise<V2PartnerOffer[] | null> {
  const user = await getCurrentUser();
  return loadPartnerOffers(user?.id);
}

export async function v2ClaimPartnerOffer(slug: string): Promise<PartnerClaimResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return claimPartnerOffer(user.id, slug);
}

/** Season Pass level/progress + claimed reward cells for the current season. */
export async function v2LoadSeasonPass(): Promise<V2SeasonPass | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadSeasonPass(user.id);
}

export async function v2ClaimSeasonReward(
  tier: number,
  premium: boolean,
): Promise<SeasonClaimResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return claimSeasonReward(user.id, tier, premium);
}

export async function loadV2State(): Promise<V2PlayerState | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return loadPlayerState(user.id);
}

/** The round's authoritative question set (same for every entrant, seeded by
 *  roundId). The client renders these instead of drawing its own, so the answers
 *  it submits can be re-scored server-side. */
export async function v2GetRoundQuestions(roundId: number): Promise<ClientRoundQuestion[]> {
  return getRoundClientQuestions(roundId);
}

/** The solo level's questions, served from the DB (no local bank). Drawn by the
 *  track's theme + the level's difficulty ramp. */
export async function v2GetLevelQuestions(
  track: LevelTrack,
  level: number,
): Promise<ClientRoundQuestion[]> {
  return getLevelClientQuestions(track, level);
}

// ---------------------------------------------------------------------------
// On-chain tournament (a round IS a v1 Game: real USDC entry → pool → claim).
// ---------------------------------------------------------------------------

/** The current on-chain tournament round for the player's platform, plus its
 *  questions. Null when unauthenticated or no game is scheduled. */
export async function v2GetTournament(): Promise<
  {
    game: TournamentGame;
    questions: ClientRoundQuestion[];
    /** The flat price everyone pays (the game's on-chain floor), + the higher
     *  `standardFee` for the struck-through "was" price, and `firstEntry` which
     *  drives the discount visuals. The discount is display-only — the real
     *  charge is always `entryFee` — but it always shows so entry reads as a deal. */
    entryFee: number;
    standardFee: number;
    firstEntry: boolean;
  } | null
> {
  const user = await getCurrentUser();
  if (!user) return null;
  const game = await currentTournamentGame(user.platform);
  if (!game) return null;
  const questions = await getTournamentClientQuestions(game.id);
  // Everyone pays the game's flat on-chain floor — the contract requires the
  // exact price, so there's no per-user amount. The discount framing
  // (standardFee struck through) is shown to all; nobody is charged standardFee.
  return {
    game,
    questions,
    entryFee: game.entryFee,
    standardFee: TOURNAMENT_STANDARD_FEE_USDC,
    firstEntry: true,
  };
}

/** Record a tournament entry after the player's on-chain `buyTicket` deposit.
 *  The client sends the entry tx hash; the server verifies it on-chain (reusing
 *  v1's `verifyTicketPurchase`) before creating the entry. */
export async function v2EnterTournament(gameId: string, txHash: string): Promise<EnterResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.wallet) return { ok: false, error: "no_wallet" };
  return enterTournamentOnChain({ userId: user.id, gameId, txHash, wallet: user.wallet });
}

/** Submit the tournament round's answers; the server re-scores against the
 *  game's authoritative questions and records the score on the GameEntry. */
export async function v2SubmitTournamentAnswers(
  gameId: string,
  answers: RoundAnswer[],
): Promise<{ score: number; updated: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return submitTournamentAnswers(user.id, gameId, answers);
}

/** The player's claimable prize (onchain id + merkle amount/proof) for a settled
 *  tournament game, or null if nothing to claim. The client sends the on-chain
 *  `claimPrize` then confirms via the v1 claim route. */
export async function v2GetTournamentClaim(gameId: string): Promise<TournamentClaim | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getTournamentClaim(user.id, gameId);
}

/** The player's claimable on-chain tournament prizes (for the profile list). */
export async function v2LoadTournamentClaims(): Promise<TournamentClaimItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return loadTournamentClaims(user.id);
}

/** Standings (from the DB) for a specific tournament game — results screen +
 *  the in-quiz presence strip. */
export async function v2LoadTournamentBoard(gameId: string): Promise<TournamentBoard> {
  const user = await getCurrentUser();
  return tournamentStandings(gameId, { userId: user?.id, limit: 10 });
}

/** Standings for the platform's latest tournament game — leaderboard screen. */
export async function v2LoadTournamentLeaderboard(): Promise<TournamentBoard | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return latestTournamentStandings(user.platform, { userId: user.id, limit: 50 });
}

/** Standings for the player's CURRENT live tournament game — home card +
 *  in-quiz presence strip (entrant count). */
export async function v2LoadCurrentTournamentBoard(): Promise<TournamentBoard | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const game = await currentTournamentGame(user.platform);
  if (!game) return null;
  return tournamentStandings(game.id, { userId: user.id, limit: 10 });
}

/** Confirm an on-chain prize claim after the client sends `claimPrize`. Verifies
 *  the tx (reused `verifyClaim`) and marks the entry claimed. */
export async function v2ConfirmTournamentClaim(
  gameId: string,
  txHash: string,
): Promise<{ ok: boolean; error?: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.wallet) return { ok: false, error: "no_wallet" };
  return confirmTournamentClaim({ userId: user.id, gameId, txHash, wallet: user.wallet });
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

/** One-time v2-migration welcome modal: whether to show it (migrated + not yet
 *  dismissed), and dismissal. */
export async function v2GetMigrationNotice(): Promise<{ show: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { show: false };
  return getMigrationNotice(user.id);
}

export async function v2DismissMigrationNotice(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await dismissMigrationNotice(user.id);
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
