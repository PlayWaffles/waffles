"use client";

import { useQuery } from "@tanstack/react-query";
import type { LevelTrack } from "@/lib/player/roundQuestions";
import {
  getTournament,
  listPreviousGames,
  loadAllTimeLeaderboard,
  loadAnnouncements,
  loadCurrentTournamentBoard,
  loadLevelsLeaderboard,
  loadMissions,
  loadPartnerOffers,
  loadRecentEntrants,
  loadResults,
  loadState,
  loadTournamentBoard,
  loadTournamentClaims,
} from "@/player/api";
import {
  isDeploymentSkewError,
  reloadForDeploymentSkew,
} from "@/components/DeploymentSkewReloader";

const LIVE_REFRESH_MS = 20_000;
const READY_RETRIES = 5;
const READY_RETRY_DELAY_MS = 1200;

const liveQueryOptions = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 10_000,
  retry: READY_RETRIES,
  retryDelay: READY_RETRY_DELAY_MS,
};

const stableQueryOptions = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 60_000,
  retry: READY_RETRIES,
  retryDelay: READY_RETRY_DELAY_MS,
};

export const playerQueryKeys = {
  state: (userId: string | null) => ["player", "state", userId] as const,
  announcements: (userId: string | null) => ["player", "announcements", userId ?? "public"] as const,
  resultNotifications: (userId: string | null) => ["player", "result-notifications", userId] as const,
  tournament: () => ["player", "tournament"] as const,
  currentTournamentBoard: () => ["player", "tournament-board", "current"] as const,
  tournamentBoard: (gameId: string) => ["player", "tournament-board", gameId] as const,
  recentEntrants: (gameId: string | null) => ["player", "recent-entrants", gameId ?? "current"] as const,
  disabledTournamentBoard: () => ["player", "tournament-board", "disabled"] as const,
  allTimeLeaderboard: () => ["player", "leaderboard", "all-time"] as const,
  levelsLeaderboard: (track: string) => ["player", "leaderboard", "levels", track] as const,
  previousGames: () => ["player", "previous-games"] as const,
  missions: () => ["player", "missions"] as const,
  partnerOffers: () => ["player", "partner-offers"] as const,
  tournamentClaims: () => ["player", "tournament-claims"] as const,
};

export function requireReady<T>(value: T | null | undefined, label: string): T {
  if (value == null) {
    throw new Error(`${label} is not ready`);
  }
  return value;
}

export async function queryPlayerApi<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isDeploymentSkewError(error)) {
      reloadForDeploymentSkew();
    }
    throw error;
  }
}

export function usePlayerStateQuery(userId: string | null) {
  return useQuery({
    queryKey: playerQueryKeys.state(userId),
    queryFn: () => queryPlayerApi(async () => requireReady(await loadState(), "Player state")),
    enabled: Boolean(userId),
    ...stableQueryOptions,
  });
}

export function usePlayerAnnouncementsQuery(userId: string | null) {
  return useQuery({
    queryKey: playerQueryKeys.announcements(userId),
    queryFn: () => queryPlayerApi(loadAnnouncements),
    ...stableQueryOptions,
  });
}

export function usePlayerResultNotificationsQuery(userId: string | null) {
  return useQuery({
    queryKey: playerQueryKeys.resultNotifications(userId),
    queryFn: () => queryPlayerApi(loadResults),
    enabled: Boolean(userId),
    ...stableQueryOptions,
  });
}

export function useHomeTournamentQuery() {
  return useQuery({
    queryKey: playerQueryKeys.tournament(),
    queryFn: () => queryPlayerApi(async () => requireReady(await getTournament(), "Tournament")),
    refetchInterval: LIVE_REFRESH_MS,
    ...liveQueryOptions,
  });
}

export function useCurrentTournamentBoardQuery() {
  return useQuery({
    queryKey: playerQueryKeys.currentTournamentBoard(),
    queryFn: () =>
      queryPlayerApi(async () =>
        requireReady(await loadCurrentTournamentBoard(), "Tournament board"),
      ),
    refetchInterval: LIVE_REFRESH_MS,
    ...liveQueryOptions,
  });
}

export function useTournamentBoardQuery(gameId: string | null) {
  return useQuery({
    queryKey: gameId ? playerQueryKeys.tournamentBoard(gameId) : playerQueryKeys.disabledTournamentBoard(),
    queryFn: () => {
      if (!gameId) throw new Error("Tournament game id is required");
      return queryPlayerApi(() => loadTournamentBoard(gameId));
    },
    enabled: Boolean(gameId),
    ...stableQueryOptions,
  });
}

export function useResultsTournamentBoardQuery(gameId: string | null) {
  return useQuery({
    queryKey: gameId ? playerQueryKeys.tournamentBoard(gameId) : playerQueryKeys.currentTournamentBoard(),
    queryFn: () =>
      queryPlayerApi(async () =>
        gameId
          ? loadTournamentBoard(gameId)
          : requireReady(await loadCurrentTournamentBoard(), "Tournament board"),
      ),
    refetchInterval: LIVE_REFRESH_MS,
    ...liveQueryOptions,
  });
}

export function useRecentEntrantsQuery(gameId: string | null) {
  return useQuery({
    queryKey: playerQueryKeys.recentEntrants(gameId),
    queryFn: () => queryPlayerApi(loadRecentEntrants),
    refetchInterval: LIVE_REFRESH_MS,
    ...liveQueryOptions,
  });
}

export function useAllTimeLeaderboardQuery() {
  return useQuery({
    queryKey: playerQueryKeys.allTimeLeaderboard(),
    queryFn: () => queryPlayerApi(async () => requireReady(await loadAllTimeLeaderboard(), "All-time leaderboard")),
    ...stableQueryOptions,
  });
}

export function useLevelsLeaderboardQuery(track: LevelTrack) {
  return useQuery({
    queryKey: playerQueryKeys.levelsLeaderboard(track),
    queryFn: () => queryPlayerApi(async () => requireReady(await loadLevelsLeaderboard(track), "Levels leaderboard")),
    ...stableQueryOptions,
  });
}

export function usePreviousGamesQuery() {
  return useQuery({
    queryKey: playerQueryKeys.previousGames(),
    queryFn: () => queryPlayerApi(listPreviousGames),
    ...stableQueryOptions,
  });
}

export function useMissionsQuery() {
  return useQuery({
    queryKey: playerQueryKeys.missions(),
    queryFn: () => queryPlayerApi(async () => requireReady(await loadMissions(), "Missions")),
    ...stableQueryOptions,
  });
}

export function usePartnerOffersQuery() {
  return useQuery({
    queryKey: playerQueryKeys.partnerOffers(),
    queryFn: () => queryPlayerApi(async () => requireReady(await loadPartnerOffers(), "Partner offers")),
    ...stableQueryOptions,
  });
}

export function useTournamentClaimsQuery() {
  return useQuery({
    queryKey: playerQueryKeys.tournamentClaims(),
    queryFn: () => queryPlayerApi(loadTournamentClaims),
    ...stableQueryOptions,
  });
}
