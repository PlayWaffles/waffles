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
// Each lib module is namespace-imported as a `*Svc` so the action wrappers can
// share the service's name (e.g. action `loseLife` delegates to `playerSvc.loseLife`).
import * as playerSvc from "@/lib/player/playerState";
import type { PlayerState, Track } from "@/lib/player/playerState";
import { getLevelClientQuestions, themeLabel, type ClientRoundQuestion, type LevelTrack } from "@/lib/player/roundQuestions";
import { topWinnerShare } from "@/lib/game/prizeDistribution";
import * as tournamentSvc from "@/lib/player/tournamentGames";
import type { EnterResult, TournamentBoard, TournamentClaim, TournamentClaimItem, TournamentGame } from "@/lib/player/tournamentGames";
import * as migrationSvc from "@/lib/player/migrationNotice";
import type { RoundAnswer } from "@/lib/player/scoring";
import * as economySvc from "@/lib/player/economy";
import type { DailyClaimResult, PurchaseResult, ShopCatalog } from "@/lib/player/economy";
import { PowerUpKind } from "@prisma";
import * as missionsSvc from "@/lib/player/missions";
import * as announcementsSvc from "@/lib/player/announcements";
import type { PlayerAnnouncement } from "@/lib/player/announcements";
import type { Mission, ClaimMissionResult } from "@/lib/player/missions";
import * as leaguesSvc from "@/lib/player/leagues";
import type { League } from "@/lib/player/leagues";
import * as partnerSvc from "@/lib/player/partnerOffers";
import type { PartnerOffer, PartnerClaimResult } from "@/lib/player/partnerOffers";
import * as seasonSvc from "@/lib/player/seasonPass";
import type { SeasonPass, SeasonClaimResult } from "@/lib/player/seasonPass";
import { TicketLedgerReason } from "@prisma";

/** Forward a client-side log line to the server terminal. The wallet/render
 *  flows run in the browser; this surfaces their logs (and errors) where the
 *  operator watches. Best-effort, no auth — diagnostics only. */
export async function logClient(tag: string, data?: unknown): Promise<void> {
  if (data === undefined) console.log(tag);
  else console.log(tag, data);
}

export async function loadMissions(): Promise<Mission[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return missionsSvc.loadMissions(user.id);
}

export async function recordMissionEvent(eventType: string, n = 1): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await missionsSvc.recordMissionEvent(user.id, eventType, n);
}

export async function claimMission(slug: string): Promise<ClaimMissionResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return missionsSvc.claimMission(user.id, slug);
}

export async function loadLeague(): Promise<League | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return leaguesSvc.loadLeague(user.id);
}

export async function loadLeagueResult(): Promise<leaguesSvc.LeagueResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return leaguesSvc.loadLeagueResult(user.id);
}

/** Sponsored partner offers (Missions → Partners tab), with per-user claim state. */
export async function loadPartnerOffers(): Promise<PartnerOffer[] | null> {
  const user = await getCurrentUser();
  return partnerSvc.loadPartnerOffers(user?.id);
}

export async function claimPartnerOffer(slug: string): Promise<PartnerClaimResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return partnerSvc.claimPartnerOffer(user.id, slug);
}

/** Season Pass level/progress + claimed reward cells for the current season. */
export async function loadSeasonPass(): Promise<SeasonPass | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return seasonSvc.loadSeasonPass(user.id);
}

export async function claimSeasonReward(
  tier: number,
  premium: boolean,
): Promise<SeasonClaimResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return seasonSvc.claimSeasonReward(user.id, tier, premium);
}

export async function loadState(): Promise<PlayerState | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return playerSvc.loadPlayerState(user.id);
}

/** Self-serve account deletion (the in-app reset). Only ever deletes the caller's
 *  own account — auth-scoped, so a user can't delete anyone else. */
export async function deleteMyAccount(): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  await playerSvc.deleteOwnAccount(user.id);
  return { ok: true };
}

/** The solo level's questions, served from the DB (no local bank). Drawn by the
 *  track's theme + the level's difficulty ramp. */
export async function getLevelQuestions(
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
/** Live, DB-backed summary for the Home hero card — replaces the hardcoded
 *  title/format/prize copy. `topPrizeUsdc` is the #1 finisher's projected cut
 *  of the *current* pool (same bracket math settlement uses); the client floors
 *  the headline against the advertised guarantee. */
export type TournamentRound = {
  title: string;
  category: string;
  questionCount: number;
  roundSeconds: number;
  playerCount: number;
  prizePoolUsdc: number;
  topPrizeUsdc: number;
};

export async function getTournament(): Promise<
  {
    game: TournamentGame;
    questions: ClientRoundQuestion[];
    /** The flat price everyone pays (the game's on-chain floor), + the higher
     *  `standardFee` for the struck-through "was" price, and `firstEntry` =
     *  whether this is the player's first-ever tournament. The discount card
     *  shows for everyone (display-only; the real charge is always `entryFee`);
     *  `firstEntry` only personalizes the copy (first-timer vs World Cup). */
    entryFee: number;
    standardFee: number;
    firstEntry: boolean;
    round: TournamentRound;
  } | null
> {
  const user = await getCurrentUser();
  if (!user) return null;
  const game = await tournamentSvc.currentTournamentGame(user.platform);
  if (!game) return null;
  const [questions, firstEntry] = await Promise.all([
    tournamentSvc.getTournamentClientQuestions(game.id),
    tournamentSvc.isFirstTournamentEntry(user.id),
  ]);
  // Everyone pays the game's flat on-chain floor — the contract requires the
  // exact price, so there's no per-user amount. The discount framing
  // (standardFee struck through) is shown to all; nobody is charged standardFee.
  // `firstEntry` only personalizes the upsell copy (first-timer welcome vs the
  // evergreen World Cup framing) — it does NOT change the price.
  const roundSeconds = questions.reduce((sum, q) => sum + (q.time ?? 0), 0);
  return {
    game,
    questions,
    entryFee: game.entryFee,
    standardFee: tournamentSvc.TOURNAMENT_STANDARD_FEE_USDC,
    firstEntry,
    round: {
      title: game.title,
      category: themeLabel(game.theme),
      questionCount: questions.length,
      roundSeconds,
      playerCount: game.playerCount,
      prizePoolUsdc: game.prizePool,
      topPrizeUsdc: game.prizePool * topWinnerShare(game.playerCount),
    },
  };
}

/** Record a tournament entry after the player's on-chain `buyTicket` deposit.
 *  The client sends the entry tx hash; the server verifies it on-chain (reusing
 *  v1's `verifyTicketPurchase`) before creating the entry. */
export async function enterTournament(gameId: string, txHash: string): Promise<EnterResult | null> {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("[buy-ticket] enterTournament: no authed user", { gameId, txHash });
    return null;
  }
  if (!user.wallet) {
    console.warn("[buy-ticket] enterTournament: user has no wallet", { userId: user.id, gameId });
    return { ok: false, error: "no_wallet" };
  }
  const res = await tournamentSvc.enterTournamentOnChain({ userId: user.id, gameId, txHash, wallet: user.wallet });
  console.log("[buy-ticket] enterTournament result", { userId: user.id, gameId, ok: res.ok, error: res.ok ? undefined : res.error });
  return res;
}

/** Submit the tournament round's answers; the server re-scores against the
 *  game's authoritative questions and records the score on the GameEntry. */
export async function submitTournamentAnswers(
  gameId: string,
  answers: RoundAnswer[],
): Promise<{ score: number; updated: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return tournamentSvc.submitTournamentAnswers(user.id, gameId, answers);
}

/** The player's claimable prize (onchain id + merkle amount/proof) for a settled
 *  tournament game, or null if nothing to claim. The client sends the on-chain
 *  `claimPrize` then confirms via the v1 claim route. */
export async function getTournamentClaim(gameId: string): Promise<TournamentClaim | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return tournamentSvc.getTournamentClaim(user.id, gameId);
}

/** The player's claimable on-chain tournament prizes (for the profile list). */
export async function loadTournamentClaims(): Promise<TournamentClaimItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  return tournamentSvc.loadTournamentClaims(user.id);
}

/** Standings (from the DB) for a specific tournament game — results screen +
 *  the in-quiz presence strip. */
export async function loadTournamentBoard(gameId: string): Promise<TournamentBoard> {
  const user = await getCurrentUser();
  return tournamentSvc.tournamentStandings(gameId, { userId: user?.id, limit: 10 });
}

/** Standings for the platform's latest tournament game — leaderboard screen. */
export async function loadTournamentLeaderboard(): Promise<TournamentBoard | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return tournamentSvc.latestTournamentStandings(user.platform, { userId: user.id, limit: 50 });
}

/** Standings for the player's CURRENT live tournament game — home card +
 *  in-quiz presence strip (entrant count). */
export async function loadCurrentTournamentBoard(): Promise<TournamentBoard | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const game = await tournamentSvc.currentTournamentGame(user.platform);
  if (!game) return null;
  return tournamentSvc.tournamentStandings(game.id, { userId: user.id, limit: 10 });
}

/** Confirm an on-chain prize claim after the client sends `claimPrize`. Verifies
 *  the tx (reused `verifyClaim`) and marks the entry claimed. */
export async function confirmTournamentClaim(
  gameId: string,
  txHash: string,
): Promise<{ ok: boolean; error?: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.wallet) return { ok: false, error: "no_wallet" };
  return tournamentSvc.confirmTournamentClaim({ userId: user.id, gameId, txHash, wallet: user.wallet });
}

export async function reconcileTournamentClaim(
  gameId: string,
): Promise<{ ok: boolean; reconciled: boolean; error?: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.wallet) return { ok: false, reconciled: false, error: "no_wallet" };
  return tournamentSvc.reconcileTournamentClaim({ userId: user.id, gameId, wallet: user.wallet });
}

export async function claimDaily(): Promise<DailyClaimResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.claimDailyReward(user.id);
}

export async function purchase(slug: string): Promise<PurchaseResult | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.purchaseShopItem(user.id, slug);
}

/** The shop catalog (prices/labels) from the DB + this user's owned cosmetics.
 *  Single source of truth — the client renders from this, never hardcoded prices. */
export async function getShopCatalog(): Promise<ShopCatalog | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.loadShopCatalog(user.id);
}

export async function advanceLevel(
  track: Track,
  xpGain: number,
): Promise<{ level: number; ticketAwarded: boolean } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return playerSvc.advanceLevel(user.id, track, xpGain);
}

export async function loseLife(): Promise<{ lives: number; nextLifeAt: number | null } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return playerSvc.loseLife(user.id);
}

export async function refillLives(): Promise<{ lives: number; tickets: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return playerSvc.refillLives(user.id);
}


/** Generic ticket adjustment for client-side economy events (e.g. tournament
 *  entry charge, daily reward). Reason is validated against the enum. */
export async function adjustTickets(
  delta: number,
  reason: keyof typeof TicketLedgerReason,
  refId?: string,
): Promise<{ tickets: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const tickets = await playerSvc.adjustTickets(user.id, delta, TicketLedgerReason[reason], { refId });
  return { tickets };
}

export async function setAnnouncementsRead(ids: string[]): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await playerSvc.setAnnouncementRead(user.id, ids);
}

/** Active announcement feed (authored DB rows + per-user triggered cards). */
export async function loadAnnouncements(): Promise<PlayerAnnouncement[]> {
  const user = await getCurrentUser();
  return announcementsSvc.loadAnnouncements(user?.id ?? null);
}

/** One-time v2-migration welcome modal: whether to show it (migrated + not yet
 *  dismissed), and dismissal. */
export async function getMigrationNotice(): Promise<{ show: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { show: false };
  return migrationSvc.getMigrationNotice(user.id);
}

export async function dismissMigrationNotice(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await migrationSvc.dismissMigrationNotice(user.id);
}

export async function dismissAnnouncement(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await playerSvc.setAnnouncementDismissed(user.id, id);
}

export async function setUsername(username: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await playerSvc.setUsername(user.id, username);
}

export async function setAvatar(avatarId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await playerSvc.setAvatar(user.id, avatarId);
}

export async function recordBadge(badgeId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await playerSvc.recordBadge(user.id, badgeId);
}

export async function buyStreakFreeze(): Promise<{ tickets: number; freezes: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.buyStreakFreeze(user.id);
}

export async function buyBundle(slug: string, txHash?: string): Promise<{ tickets: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.buyBundle(user.id, slug, txHash);
}

export type PowerUps = Record<keyof typeof PowerUpKind, number>;

export async function loadPowerUps(): Promise<PowerUps | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.loadPowerUps(user.id) as Promise<PowerUps>;
}

export async function consumePowerUp(
  kind: keyof typeof PowerUpKind,
): Promise<{ ok: boolean; remaining: number } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return economySvc.consumePowerUp(user.id, PowerUpKind[kind]);
}
