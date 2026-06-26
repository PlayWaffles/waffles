"use client";

import type { Track } from "@/lib/player/playerState";
import type { ClientRoundQuestion, LevelTrack } from "@/lib/player/roundQuestions";
import type {
  EnterResult,
  TournamentBoard,
  TournamentClaim,
  TournamentClaimItem,
  TournamentEntrySource,
  TournamentGame,
} from "@/lib/player/tournamentGames";
import type { LevelBoard } from "@/lib/player/levelsLeaderboard";
import type { RoundAnswer } from "@/lib/player/scoring";
import type { DailyClaimResult, PurchaseResult, ShopCatalog } from "@/lib/player/economy";
import type { PlayerAnnouncement } from "@/lib/player/announcements";
import type { Mission, ClaimMissionResult } from "@/lib/player/missions";
import type { League } from "@/lib/player/leagues";
import type { PartnerOffer, PartnerClaimResult } from "@/lib/player/partnerOffers";
import type { SeasonPass, SeasonClaimResult } from "@/lib/player/seasonPass";
import type { PlayerState } from "@/lib/player/playerState";
import type { TournamentRound, PowerUps } from "@/lib/player/playerApi";
import type * as leaguesSvc from "@/lib/player/leagues";
import type * as tournamentSvc from "@/lib/player/tournamentGames";
import type * as rookieCupSvc from "@/lib/player/rookieCup";
import type { TicketLedgerReason } from "@prisma";
import type { PowerUpKind } from "@prisma";

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function reviveDates(_key: string, value: unknown) {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

async function callPlayerApi<T>(action: string, args: unknown[] = []): Promise<T> {
  const response = await fetch(`/api/v1/player/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text, reviveDates) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : `Player API request failed: ${response.status}`;
    throw new Error(message);
  }

  return payload.data as T;
}

export function logClient(tag: string, data?: unknown): Promise<void> {
  return callPlayerApi("logClient", [tag, data]);
}

export function loadMissions(): Promise<Mission[] | null> {
  return callPlayerApi("loadMissions");
}

export function recordMissionEvent(eventType: string, n = 1): Promise<void> {
  return callPlayerApi("recordMissionEvent", [eventType, n]);
}

export function claimMission(slug: string): Promise<ClaimMissionResult | null> {
  return callPlayerApi("claimMission", [slug]);
}

export function loadLeague(): Promise<League | null> {
  return callPlayerApi("loadLeague");
}

export function loadLeagueLeaderboard(): Promise<leaguesSvc.LeagueLeaderboard | null> {
  return callPlayerApi("loadLeagueLeaderboard");
}

export function loadLeagueResult(): Promise<leaguesSvc.LeagueResult | null> {
  return callPlayerApi("loadLeagueResult");
}

export function loadPartnerOffers(): Promise<PartnerOffer[] | null> {
  return callPlayerApi("loadPartnerOffers");
}

export function claimPartnerOffer(slug: string): Promise<PartnerClaimResult | null> {
  return callPlayerApi("claimPartnerOffer", [slug]);
}

export function loadSeasonPass(): Promise<SeasonPass | null> {
  return callPlayerApi("loadSeasonPass");
}

export function claimSeasonReward(
  tier: number,
  premium: boolean,
): Promise<SeasonClaimResult | null> {
  return callPlayerApi("claimSeasonReward", [tier, premium]);
}

export function loadState(): Promise<PlayerState | null> {
  return callPlayerApi("loadState");
}

export function deleteMyAccount(): Promise<{ ok: boolean }> {
  return callPlayerApi("deleteMyAccount");
}

export function getLevelQuestions(
  track: LevelTrack,
  level: number,
): Promise<ClientRoundQuestion[]> {
  return callPlayerApi("getLevelQuestions", [track, level]);
}

export function loadResults(): Promise<tournamentSvc.PlayerResult[]> {
  return callPlayerApi("loadResults");
}

export function recordLevelPlay(
  answers: { id: string; selection: number[]; responseMs: number }[],
): Promise<void> {
  return callPlayerApi("recordLevelPlay", [answers]);
}

export function getTournament(): Promise<{
  game: TournamentGame;
  questions: ClientRoundQuestion[];
  entryFee: number;
  standardFee: number;
  firstEntry: boolean;
  skillBonus: number;
  round: TournamentRound;
} | null> {
  return callPlayerApi("getTournament");
}

export function enterTournament(
  gameId: string,
  txHash: string,
  entrySource: TournamentEntrySource = "unknown",
): Promise<EnterResult | null> {
  return callPlayerApi("enterTournament", [gameId, txHash, entrySource]);
}

export function submitTournamentAnswers(
  gameId: string,
  answers: RoundAnswer[],
): Promise<{ score: number; updated: boolean } | null> {
  return callPlayerApi("submitTournamentAnswers", [gameId, answers]);
}

export function getTournamentClaim(gameId: string): Promise<TournamentClaim | null> {
  return callPlayerApi("getTournamentClaim", [gameId]);
}

export function loadTournamentClaims(): Promise<TournamentClaimItem[]> {
  return callPlayerApi("loadTournamentClaims");
}

export function loadTournamentBoard(gameId: string): Promise<TournamentBoard> {
  return callPlayerApi("loadTournamentBoard", [gameId]);
}

export function loadTournamentLeaderboard(): Promise<TournamentBoard | null> {
  return callPlayerApi("loadTournamentLeaderboard");
}

export function loadCurrentTournamentBoard(): Promise<TournamentBoard | null> {
  return callPlayerApi("loadCurrentTournamentBoard");
}

export function getRookieCup(): Promise<rookieCupSvc.RookieCup | null> {
  return callPlayerApi("getRookieCup");
}

export function submitRookieCup(answers: RoundAnswer[]): Promise<rookieCupSvc.RookieResult | null> {
  return callPlayerApi("submitRookieCup", [answers]);
}

export function loadAllTimeLeaderboard(): Promise<TournamentBoard | null> {
  return callPlayerApi("loadAllTimeLeaderboard");
}

export function loadLevelsLeaderboard(): Promise<LevelBoard | null> {
  return callPlayerApi("loadLevelsLeaderboard");
}

export function listPreviousGames(): Promise<tournamentSvc.PreviousGame[]> {
  return callPlayerApi("listPreviousGames");
}

export type RecentEntrant = { userId: string; name: string; avatarId: string | null };
export function loadRecentEntrants(): Promise<RecentEntrant[]> {
  return callPlayerApi("loadRecentEntrants");
}

export function confirmTournamentClaim(
  gameId: string,
  txHash: string,
): Promise<{ ok: boolean; error?: string } | null> {
  return callPlayerApi("confirmTournamentClaim", [gameId, txHash]);
}

export function reconcileTournamentClaim(
  gameId: string,
): Promise<{ ok: boolean; reconciled: boolean; error?: string } | null> {
  return callPlayerApi("reconcileTournamentClaim", [gameId]);
}

export function claimDaily(): Promise<DailyClaimResult | null> {
  return callPlayerApi("claimDaily");
}

export function purchase(slug: string): Promise<PurchaseResult | null> {
  return callPlayerApi("purchase", [slug]);
}

export function getShopCatalog(): Promise<ShopCatalog | null> {
  return callPlayerApi("getShopCatalog");
}

export function advanceLevel(
  track: Track,
  xpGain: number,
): Promise<{ level: number; ticketAwarded: boolean } | null> {
  return callPlayerApi("advanceLevel", [track, xpGain]);
}

export function loseLife(): Promise<{ lives: number; nextLifeAt: number | null } | null> {
  return callPlayerApi("loseLife");
}

export function refillLives(): Promise<{ lives: number; tickets: number } | null> {
  return callPlayerApi("refillLives");
}

export function adjustTickets(
  delta: number,
  reason: keyof typeof TicketLedgerReason,
  refId?: string,
): Promise<{ tickets: number } | null> {
  return callPlayerApi("adjustTickets", [delta, reason, refId]);
}

export function setAnnouncementsRead(ids: string[]): Promise<void> {
  return callPlayerApi("setAnnouncementsRead", [ids]);
}

export function loadAnnouncements(): Promise<PlayerAnnouncement[]> {
  return callPlayerApi("loadAnnouncements");
}

export function getAnnouncementRealtimeToken(): Promise<{
  host: string;
  room: string;
  token: string;
} | null> {
  return callPlayerApi("getAnnouncementRealtimeToken");
}

export function getMigrationNotice(): Promise<{ show: boolean }> {
  return callPlayerApi("getMigrationNotice");
}

export function dismissMigrationNotice(): Promise<void> {
  return callPlayerApi("dismissMigrationNotice");
}

export function getWorldCupTakeover(): Promise<{ show: boolean }> {
  return callPlayerApi("getWorldCupTakeover");
}

export function dismissWorldCupTakeover(): Promise<void> {
  return callPlayerApi("dismissWorldCupTakeover");
}

export function dismissAnnouncement(id: string): Promise<void> {
  return callPlayerApi("dismissAnnouncement", [id]);
}

export function setUsername(username: string): Promise<void> {
  return callPlayerApi("setUsername", [username]);
}

export function setAvatar(avatarId: string): Promise<void> {
  return callPlayerApi("setAvatar", [avatarId]);
}

export function recordBadge(badgeId: string, name?: string): Promise<void> {
  return callPlayerApi("recordBadge", [badgeId, name]);
}

export function buyStreakFreeze(): Promise<{ tickets: number; freezes: number } | null> {
  return callPlayerApi("buyStreakFreeze");
}

export function buyBundle(slug: string, txHash?: string): Promise<{ tickets: number } | null> {
  return callPlayerApi("buyBundle", [slug, txHash]);
}

export function loadPowerUps(): Promise<PowerUps | null> {
  return callPlayerApi("loadPowerUps");
}

export function consumePowerUp(
  kind: keyof typeof PowerUpKind,
): Promise<{ ok: boolean; remaining: number } | null> {
  return callPlayerApi("consumePowerUp", [kind]);
}

export type { TournamentRound, PowerUps };
