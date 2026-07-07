import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import * as H from "@/lib/player/playerHandlers";
import {
  withOptionalPlayer,
  withPlayerMutation,
  withPlayerRead,
  withPlayerReadList,
  withPlayerReadOr,
} from "@/lib/player/withPlayerAuth";

async function enterTournament(
  gameId: string,
  txHash: string,
  entrySource?: import("@/lib/player/tournamentGames").TournamentEntrySource,
) {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("[buy-ticket] enterTournament: no authed user", { gameId, txHash });
    return null;
  }
  return H.enterTournament(user, gameId, txHash, entrySource);
}

const handlers = {
  logClient: H.logClient,
  loadMissions: withPlayerRead(H.loadMissions),
  recordMissionEvent: withPlayerMutation(H.recordMissionEvent),
  claimMission: withPlayerRead(H.claimMission),
  loadLeague: withPlayerRead(H.loadLeague),
  loadLeagueLeaderboard: withPlayerRead(H.loadLeagueLeaderboard),
  loadLeagueResult: withPlayerRead(H.loadLeagueResult),
  loadPartnerOffers: withOptionalPlayer(H.loadPartnerOffers),
  claimPartnerOffer: withPlayerRead(H.claimPartnerOffer),
  loadSeasonPass: withPlayerRead(H.loadSeasonPass),
  claimSeasonReward: withPlayerRead(H.claimSeasonReward),
  loadState: withPlayerRead(H.loadState),
  deleteMyAccount: withPlayerReadOr(H.deleteMyAccount, { ok: false }),
  getLevelQuestions: withPlayerReadList(H.getLevelQuestions),
  loadResults: withPlayerReadList(H.loadResults),
  recordLevelPlay: withPlayerMutation(H.recordLevelPlay),
  getTournament: withPlayerRead(H.getTournament),
  enterTournament,
  reconcileTournamentEntry: withPlayerRead(H.reconcileTournamentEntry),
  submitTournamentAnswers: withPlayerRead(H.submitTournamentAnswers),
  getTournamentClaim: withPlayerRead(H.getTournamentClaim),
  loadTournamentClaims: withPlayerReadList(H.loadTournamentClaims),
  loadTournamentBoard: withOptionalPlayer(H.loadTournamentBoard),
  loadTournamentLeaderboard: withPlayerRead(H.loadTournamentLeaderboard),
  loadCurrentTournamentBoard: withPlayerRead(H.loadCurrentTournamentBoard),
  loadAllTimeLeaderboard: withPlayerRead(H.loadAllTimeLeaderboard),
  loadLevelsLeaderboard: withPlayerRead(H.loadLevelsLeaderboard),
  listPreviousGames: withPlayerReadList(H.listPreviousGames),
  getRookieCup: withPlayerRead(H.getRookieCup),
  submitRookieCup: withPlayerRead(H.submitRookieCup),
  loadRecentEntrants: withPlayerReadList(H.loadRecentEntrants),
  confirmTournamentClaim: withPlayerRead(H.confirmTournamentClaim),
  reconcileTournamentClaim: withPlayerRead(H.reconcileTournamentClaim),
  claimDaily: withPlayerRead(H.claimDaily),
  purchase: withPlayerRead(H.purchase),
  getShopCatalog: withPlayerRead(H.getShopCatalog),
  advanceLevel: withPlayerRead(H.advanceLevel),
  loseLife: withPlayerRead(H.loseLife),
  refillLives: withPlayerRead(H.refillLives),
  adjustTickets: withPlayerRead(H.adjustTickets),
  setAnnouncementsRead: withPlayerMutation(H.setAnnouncementsRead),
  loadAnnouncements: withOptionalPlayer(H.loadAnnouncements),
  getAnnouncementRealtimeToken: withPlayerRead(H.getAnnouncementRealtimeToken),
  getMigrationNotice: withPlayerReadOr(H.getMigrationNotice, { show: false }),
  dismissMigrationNotice: withPlayerMutation(H.dismissMigrationNotice),
  getWorldCupTakeover: withPlayerReadOr(H.getWorldCupTakeover, { show: false }),
  dismissWorldCupTakeover: withPlayerMutation(H.dismissWorldCupTakeover),
  dismissAnnouncement: withPlayerMutation(H.dismissAnnouncement),
  setUsername: withPlayerMutation(H.setUsername),
  setAvatar: withPlayerMutation(H.setAvatar),
  recordBadge: withPlayerMutation(H.recordBadge),
  buyStreakFreeze: withPlayerRead(H.buyStreakFreeze),
  buyBundle: withPlayerRead(H.buyBundle),
  loadPowerUps: withPlayerRead(H.loadPowerUps),
  consumePowerUp: withPlayerRead(H.consumePowerUp),
} as const;

type PlayerAction = keyof typeof handlers;

function isPlayerAction(action: string): action is PlayerAction {
  return action in handlers;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;

  if (!isPlayerAction(action)) {
    return NextResponse.json(
      { error: `Unknown player action: ${action}` },
      { status: 404 },
    );
  }

  const body = (await request.json()) as { args?: unknown[] };
  const args = Array.isArray(body.args) ? body.args : [];
  const handler = handlers[action] as (...args: unknown[]) => Promise<unknown>;
  const data = await handler(...args);

  return NextResponse.json({ data });
}