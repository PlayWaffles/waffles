import { NextRequest, NextResponse } from "next/server";

import * as playerApi from "@/lib/player/playerApi";

const handlers = {
  logClient: playerApi.logClient,
  loadMissions: playerApi.loadMissions,
  recordMissionEvent: playerApi.recordMissionEvent,
  claimMission: playerApi.claimMission,
  loadLeague: playerApi.loadLeague,
  loadLeagueLeaderboard: playerApi.loadLeagueLeaderboard,
  loadLeagueResult: playerApi.loadLeagueResult,
  loadPartnerOffers: playerApi.loadPartnerOffers,
  claimPartnerOffer: playerApi.claimPartnerOffer,
  loadSeasonPass: playerApi.loadSeasonPass,
  claimSeasonReward: playerApi.claimSeasonReward,
  loadState: playerApi.loadState,
  deleteMyAccount: playerApi.deleteMyAccount,
  getLevelQuestions: playerApi.getLevelQuestions,
  loadResults: playerApi.loadResults,
  recordLevelPlay: playerApi.recordLevelPlay,
  getTournament: playerApi.getTournament,
  enterTournament: playerApi.enterTournament,
  submitTournamentAnswers: playerApi.submitTournamentAnswers,
  getTournamentClaim: playerApi.getTournamentClaim,
  loadTournamentClaims: playerApi.loadTournamentClaims,
  loadTournamentBoard: playerApi.loadTournamentBoard,
  loadTournamentLeaderboard: playerApi.loadTournamentLeaderboard,
  loadCurrentTournamentBoard: playerApi.loadCurrentTournamentBoard,
  loadAllTimeLeaderboard: playerApi.loadAllTimeLeaderboard,
  loadLevelsLeaderboard: playerApi.loadLevelsLeaderboard,
  listPreviousGames: playerApi.listPreviousGames,
  getRookieCup: playerApi.getRookieCup,
  submitRookieCup: playerApi.submitRookieCup,
  loadRecentEntrants: playerApi.loadRecentEntrants,
  confirmTournamentClaim: playerApi.confirmTournamentClaim,
  reconcileTournamentClaim: playerApi.reconcileTournamentClaim,
  claimDaily: playerApi.claimDaily,
  purchase: playerApi.purchase,
  getShopCatalog: playerApi.getShopCatalog,
  advanceLevel: playerApi.advanceLevel,
  loseLife: playerApi.loseLife,
  refillLives: playerApi.refillLives,
  adjustTickets: playerApi.adjustTickets,
  setAnnouncementsRead: playerApi.setAnnouncementsRead,
  loadAnnouncements: playerApi.loadAnnouncements,
  getAnnouncementRealtimeToken: playerApi.getAnnouncementRealtimeToken,
  getMigrationNotice: playerApi.getMigrationNotice,
  dismissMigrationNotice: playerApi.dismissMigrationNotice,
  getWorldCupTakeover: playerApi.getWorldCupTakeover,
  dismissWorldCupTakeover: playerApi.dismissWorldCupTakeover,
  dismissAnnouncement: playerApi.dismissAnnouncement,
  setUsername: playerApi.setUsername,
  setAvatar: playerApi.setAvatar,
  recordBadge: playerApi.recordBadge,
  buyStreakFreeze: playerApi.buyStreakFreeze,
  buyBundle: playerApi.buyBundle,
  loadPowerUps: playerApi.loadPowerUps,
  consumePowerUp: playerApi.consumePowerUp,
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
