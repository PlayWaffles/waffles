/**
 * Player API business logic. Each handler takes the authenticated user as its
 * first argument — auth is applied once at the route via withPlayerAuth().
 */
import crypto from "node:crypto";

import { PowerUpKind, TicketLedgerReason } from "@prisma";

import { topWinnerShare, winnersForField } from "@/lib/game/prizeDistribution";
import * as announcementsSvc from "@/lib/player/announcements";
import type { PlayerAnnouncement } from "@/lib/player/announcements";
import type { CurrentUser } from "@/lib/player/withPlayerAuth";
import * as economySvc from "@/lib/player/economy";
import type { DailyClaimResult, PurchaseResult, ShopCatalog } from "@/lib/player/economy";
import * as leaguesSvc from "@/lib/player/leagues";
import type { League } from "@/lib/player/leagues";
import * as levelsSvc from "@/lib/player/levelsLeaderboard";
import * as migrationSvc from "@/lib/player/migrationNotice";
import * as missionsSvc from "@/lib/player/missions";
import type { ClaimMissionResult, Mission } from "@/lib/player/missions";
import * as partnerSvc from "@/lib/player/partnerOffers";
import type { PartnerClaimResult, PartnerOffer } from "@/lib/player/partnerOffers";
import * as playerSvc from "@/lib/player/playerState";
import type { PlayerState, Track } from "@/lib/player/playerState";
import * as rookieCupSvc from "@/lib/player/rookieCup";
import {
  getLevelClientQuestions,
  recordLevelQuestionStats,
  themeLabel,
  type ClientRoundQuestion,
  type LevelTrack,
} from "@/lib/player/roundQuestions";
import type { RoundAnswer } from "@/lib/player/scoring";
import * as seasonSvc from "@/lib/player/seasonPass";
import type { SeasonClaimResult, SeasonPass } from "@/lib/player/seasonPass";
import * as tournamentSvc from "@/lib/player/tournamentGames";
import type {
  EnterResult,
  TournamentBoard,
  TournamentClaim,
  TournamentClaimItem,
  TournamentEntrySource,
  TournamentGame,
  TournamentParticipantAvatar,
} from "@/lib/player/tournamentGames";
import * as wcTakeoverSvc from "@/lib/player/worldCupTakeover";
import { userAnnouncementsRoom } from "@/lib/realtime/announcementMessages";

/** Forward a client-side log line to the server terminal. Best-effort, no auth. */
export async function logClient(tag: string, data?: unknown): Promise<void> {
  if (data === undefined) console.log(tag);
  else console.log(tag, data);
}

export async function loadMissions(user: CurrentUser): Promise<Mission[]> {
  return missionsSvc.loadMissions(user.id);
}

export async function recordMissionEvent(
  user: CurrentUser,
  eventType: string,
  n = 1,
): Promise<void> {
  await missionsSvc.recordMissionEvent(user.id, eventType, n);
}

export async function claimMission(
  user: CurrentUser,
  slug: string,
): Promise<ClaimMissionResult> {
  return missionsSvc.claimMission(user.id, slug);
}

export async function loadLeague(user: CurrentUser): Promise<League> {
  return leaguesSvc.loadLeague(user.id);
}

export async function loadLeagueLeaderboard(
  user: CurrentUser,
): Promise<leaguesSvc.LeagueLeaderboard | null> {
  return leaguesSvc.loadLeagueLeaderboard(user.id);
}

export async function loadLeagueResult(
  user: CurrentUser,
): Promise<leaguesSvc.LeagueResult | null> {
  return leaguesSvc.loadLeagueResult(user.id);
}

export async function loadPartnerOffers(
  user: CurrentUser | null,
): Promise<PartnerOffer[]> {
  return partnerSvc.loadPartnerOffers(user?.id);
}

export async function claimPartnerOffer(
  user: CurrentUser,
  slug: string,
): Promise<PartnerClaimResult> {
  return partnerSvc.claimPartnerOffer(user.id, slug);
}

export async function loadSeasonPass(user: CurrentUser): Promise<SeasonPass> {
  return seasonSvc.loadSeasonPass(user.id);
}

export async function claimSeasonReward(
  user: CurrentUser,
  tier: number,
  premium: boolean,
): Promise<SeasonClaimResult> {
  return seasonSvc.claimSeasonReward(user.id, tier, premium);
}

export async function loadState(user: CurrentUser): Promise<PlayerState> {
  return playerSvc.loadPlayerState(user.id);
}

export async function deleteMyAccount(user: CurrentUser): Promise<{ ok: boolean }> {
  await playerSvc.deleteOwnAccount(user.id);
  return { ok: true };
}

export async function getLevelQuestions(
  user: CurrentUser,
  track: LevelTrack,
  level: number,
): Promise<ClientRoundQuestion[]> {
  return getLevelClientQuestions(track, level, undefined, user.id);
}

export async function loadResults(
  user: CurrentUser,
): Promise<tournamentSvc.PlayerResult[]> {
  return tournamentSvc.loadRecentResults(user.id);
}

export async function recordLevelPlay(
  user: CurrentUser,
  answers: { id: string; selection: number[]; responseMs: number }[],
): Promise<void> {
  try {
    await recordLevelQuestionStats(answers);
  } catch (e) {
    console.error("[recordLevelPlay] failed:", e);
  }
}

export type TournamentRound = {
  title: string;
  category: string;
  questionCount: number;
  roundSeconds: number;
  playerCount: number;
  maxPlayers: number;
  prizePoolUsdc: number;
  topPrizeUsdc: number;
  winnerCount: number;
  todayEntryCount: number;
  todayPlayerCount: number;
  todayPrizePoolUsdc: number;
  recentEntryCount: number;
  participantAvatars: TournamentParticipantAvatar[];
};

export async function getTournament(user: CurrentUser): Promise<{
  game: TournamentGame;
  questions: ClientRoundQuestion[];
  entryFee: number;
  standardFee: number;
  firstEntry: boolean;
  skillBonus: number;
  round: TournamentRound;
} | null> {
  try {
    await tournamentSvc.ensureTournamentGame(user.platform);
  } catch (error) {
    console.error(
      "[getTournament] ensureTournamentGame failed:",
      error instanceof Error ? error.message : error,
    );
  }
  const game = await tournamentSvc.currentTournamentGame(user.platform);
  if (!game) return null;
  const [questions, firstEntry, skillBonus] = await Promise.all([
    tournamentSvc.getTournamentClientQuestions(game.id),
    tournamentSvc.isFirstTournamentEntry(user.id),
    tournamentSvc.playerSkillBonus(user.id),
  ]);
  const roundSeconds = questions.reduce((sum, q) => sum + (q.time ?? 0), 0);
  return {
    game,
    questions,
    entryFee: game.entryFee,
    standardFee: game.entryFee * 2,
    firstEntry,
    skillBonus,
    round: {
      title: game.title,
      category: themeLabel(game.theme),
      questionCount: questions.length,
      roundSeconds,
      playerCount: game.playerCount,
      maxPlayers: game.maxPlayers,
      prizePoolUsdc: game.prizePool,
      topPrizeUsdc: game.prizePool * topWinnerShare(game.playerCount),
      winnerCount: winnersForField(game.playerCount),
      todayEntryCount: game.todayEntryCount,
      todayPlayerCount: game.todayPlayerCount,
      todayPrizePoolUsdc: game.todayPrizePool,
      recentEntryCount: game.recentEntryCount,
      participantAvatars: game.participantAvatars,
    },
  };
}

export async function enterTournament(
  user: CurrentUser,
  gameId: string,
  txHash: string,
  entrySource: TournamentEntrySource = "unknown",
): Promise<EnterResult> {
  if (!user.wallet) {
    console.warn("[buy-ticket] enterTournament: user has no wallet", {
      userId: user.id,
      gameId,
    });
    return { ok: false, error: "no_wallet" };
  }
  const res = await tournamentSvc.enterTournamentOnChain({
    userId: user.id,
    gameId,
    txHash,
    wallet: user.wallet,
    entrySource,
  });
  console.log("[buy-ticket] enterTournament result", {
    userId: user.id,
    gameId,
    ok: res.ok,
    error: res.ok ? undefined : res.error,
  });
  return res;
}

export async function reconcileTournamentEntry(
  user: CurrentUser,
  gameId: string,
): Promise<EnterResult> {
  if (!user.wallet) return { ok: false, error: "no_wallet" };
  return tournamentSvc.reconcileTournamentEntry({
    userId: user.id,
    gameId,
    wallet: user.wallet,
  });
}

export async function submitTournamentAnswers(
  user: CurrentUser,
  gameId: string,
  answers: RoundAnswer[],
): Promise<{ score: number; updated: boolean } | null> {
  return tournamentSvc.submitTournamentAnswers(user.id, gameId, answers);
}

export async function getTournamentClaim(
  user: CurrentUser,
  gameId: string,
): Promise<TournamentClaim | null> {
  return tournamentSvc.getTournamentClaim(user.id, gameId);
}

export async function loadTournamentClaims(
  user: CurrentUser,
): Promise<TournamentClaimItem[]> {
  return tournamentSvc.loadTournamentClaims(user.id);
}

export async function loadTournamentBoard(
  user: CurrentUser | null,
  gameId: string,
): Promise<TournamentBoard> {
  return tournamentSvc.tournamentStandings(gameId, {
    userId: user?.id,
    limit: 10,
    platform: user?.platform,
  });
}

export async function loadTournamentLeaderboard(
  user: CurrentUser,
): Promise<TournamentBoard | null> {
  return tournamentSvc.latestTournamentStandings(user.platform, {
    userId: user.id,
    limit: 50,
  });
}

export async function loadCurrentTournamentBoard(
  user: CurrentUser,
): Promise<TournamentBoard | null> {
  const game = await tournamentSvc.currentTournamentGame(user.platform);
  if (!game) return null;
  return tournamentSvc.tournamentStandings(game.id, { userId: user.id, limit: 10 });
}

export async function getRookieCup(user: CurrentUser): Promise<rookieCupSvc.RookieCup> {
  return rookieCupSvc.getRookieCup(user.id);
}

export async function submitRookieCup(
  user: CurrentUser,
  answers: RoundAnswer[],
): Promise<rookieCupSvc.RookieResult> {
  return rookieCupSvc.submitRookieCup(user.id, answers);
}

export async function loadAllTimeLeaderboard(
  user: CurrentUser,
): Promise<TournamentBoard | null> {
  return tournamentSvc.allTimeLeaderboard(user.platform, {
    userId: user.id,
    limit: 50,
  });
}

export async function loadLevelsLeaderboard(
  user: CurrentUser,
  track: levelsSvc.LeaderboardTrack,
): Promise<levelsSvc.LevelBoard | null> {
  return levelsSvc.levelsLeaderboard(user.platform, {
    userId: user.id,
    limit: 50,
    track,
  });
}

export async function listPreviousGames(
  user: CurrentUser,
): Promise<tournamentSvc.PreviousGame[]> {
  return tournamentSvc.listPreviousGames(user.platform, 20);
}

export async function loadRecentEntrants(
  user: CurrentUser,
): Promise<tournamentSvc.RecentEntrant[]> {
  return tournamentSvc.recentEntrants(user.platform);
}

export async function confirmTournamentClaim(
  user: CurrentUser,
  gameId: string,
  txHash: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!user.wallet) return { ok: false, error: "no_wallet" };
  return tournamentSvc.confirmTournamentClaim({
    userId: user.id,
    gameId,
    txHash,
    wallet: user.wallet,
  });
}

export async function reconcileTournamentClaim(
  user: CurrentUser,
  gameId: string,
): Promise<{ ok: boolean; reconciled: boolean; error?: string }> {
  if (!user.wallet) return { ok: false, reconciled: false, error: "no_wallet" };
  return tournamentSvc.reconcileTournamentClaim({
    userId: user.id,
    gameId,
    wallet: user.wallet,
  });
}

export async function claimDaily(user: CurrentUser): Promise<DailyClaimResult> {
  return economySvc.claimDailyReward(user.id);
}

export async function purchase(
  user: CurrentUser,
  slug: string,
): Promise<PurchaseResult> {
  return economySvc.purchaseShopItem(user.id, slug);
}

export async function getShopCatalog(user: CurrentUser): Promise<ShopCatalog> {
  return economySvc.loadShopCatalog(user.id);
}

export async function advanceLevel(
  user: CurrentUser,
  track: Track,
  xpGain: number,
): Promise<{ level: number; ticketAwarded: boolean }> {
  return playerSvc.advanceLevel(user.id, track, xpGain);
}

export async function loseLife(
  user: CurrentUser,
): Promise<{ lives: number; nextLifeAt: number | null }> {
  return playerSvc.loseLife(user.id);
}

export async function refillLives(
  user: CurrentUser,
): Promise<{ lives: number; tickets: number } | null> {
  return playerSvc.refillLives(user.id);
}

export async function adjustTickets(
  user: CurrentUser,
  delta: number,
  reason: keyof typeof TicketLedgerReason,
  refId?: string,
): Promise<{ tickets: number }> {
  const tickets = await playerSvc.adjustTickets(
    user.id,
    delta,
    TicketLedgerReason[reason],
    { refId },
  );
  return { tickets };
}

export async function setAnnouncementsRead(
  user: CurrentUser,
  ids: string[],
): Promise<void> {
  await playerSvc.setAnnouncementRead(user.id, ids);
}

export async function loadAnnouncements(
  user: CurrentUser | null,
): Promise<PlayerAnnouncement[]> {
  return announcementsSvc.loadAnnouncements(user?.id ?? null);
}

function signRealtimeToken(userId: string) {
  const secret = process.env.PARTYKIT_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing PARTYKIT_SECRET for realtime announcement authentication.");
  }
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 10 * 60,
    }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function getAnnouncementRealtimeToken(user: CurrentUser): Promise<{
  host: string;
  room: string;
  token: string;
}> {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? process.env.PARTYKIT_HOST;
  if (!host?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_PARTYKIT_HOST or PARTYKIT_HOST for realtime announcements.");
  }
  return {
    host: host.trim(),
    room: userAnnouncementsRoom(user.id),
    token: signRealtimeToken(user.id),
  };
}

export async function getMigrationNotice(user: CurrentUser): Promise<{ show: boolean }> {
  return migrationSvc.getMigrationNotice(user.id);
}

export async function dismissMigrationNotice(user: CurrentUser): Promise<void> {
  await migrationSvc.dismissMigrationNotice(user.id);
}

export async function getWorldCupTakeover(user: CurrentUser): Promise<{ show: boolean }> {
  return wcTakeoverSvc.getWorldCupTakeoverNotice(user.id);
}

export async function dismissWorldCupTakeover(user: CurrentUser): Promise<void> {
  await wcTakeoverSvc.dismissWorldCupTakeover(user.id);
}

export async function dismissAnnouncement(user: CurrentUser, id: string): Promise<void> {
  await playerSvc.setAnnouncementDismissed(user.id, id);
}

export async function setUsername(user: CurrentUser, username: string): Promise<void> {
  await playerSvc.setUsername(user.id, username);
}

export async function setAvatar(user: CurrentUser, avatarId: string): Promise<void> {
  await playerSvc.setAvatar(user.id, avatarId);
}

export async function recordBadge(
  user: CurrentUser,
  badgeId: string,
  name?: string,
): Promise<void> {
  await playerSvc.recordBadge(user.id, badgeId, name);
}

export async function buyStreakFreeze(
  user: CurrentUser,
): Promise<{ tickets: number; freezes: number } | null> {
  return economySvc.buyStreakFreeze(user.id);
}

export async function buyBundle(
  user: CurrentUser,
  slug: string,
  txHash?: string,
): Promise<{ tickets: number } | null> {
  return economySvc.buyBundle(user.id, slug, txHash);
}

export type PowerUps = Record<keyof typeof PowerUpKind, number>;

export async function loadPowerUps(user: CurrentUser): Promise<PowerUps> {
  return economySvc.loadPowerUps(user.id) as Promise<PowerUps>;
}

export async function consumePowerUp(
  user: CurrentUser,
  kind: keyof typeof PowerUpKind,
): Promise<{ ok: boolean; remaining: number }> {
  return economySvc.consumePowerUp(user.id, PowerUpKind[kind]);
}