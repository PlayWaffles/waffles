"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getTournament,
  loadCurrentTournamentBoard,
  loadMissions,
  loadRecentEntrants,
} from "@/player/api";
import {
  isDeploymentSkewError,
  reloadForDeploymentSkew,
} from "@/components/DeploymentSkewReloader";

const HOME_REFRESH_MS = 20_000;
const READY_RETRIES = 5;
const READY_RETRY_DELAY_MS = 1200;

const homeQueryOptions = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  staleTime: 10_000,
  retry: READY_RETRIES,
  retryDelay: READY_RETRY_DELAY_MS,
};

function requireReady<T>(value: T | null | undefined, label: string): T {
  if (value == null) {
    throw new Error(`${label} is not ready`);
  }
  return value;
}

async function queryPlayerApi<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isDeploymentSkewError(error)) {
      reloadForDeploymentSkew();
    }
    throw error;
  }
}

export function useHomeTournamentQuery() {
  return useQuery({
    queryKey: ["player", "home", "tournament"],
    queryFn: async () =>
      queryPlayerApi(async () =>
        requireReady(await getTournament(), "Tournament"),
      ),
    refetchInterval: HOME_REFRESH_MS,
    ...homeQueryOptions,
  });
}

export function useHomeTournamentBoardQuery(tournamentGameId: string | null) {
  return useQuery({
    queryKey: ["player", "home", "tournament-board", tournamentGameId],
    queryFn: async () =>
      queryPlayerApi(async () =>
        requireReady(await loadCurrentTournamentBoard(), "Tournament board"),
      ),
    refetchInterval: HOME_REFRESH_MS,
    ...homeQueryOptions,
  });
}

export function useHomeRecentEntrantsQuery(tournamentGameId: string | null) {
  return useQuery({
    queryKey: ["player", "home", "recent-entrants", tournamentGameId],
    queryFn: () => queryPlayerApi(loadRecentEntrants),
    refetchInterval: HOME_REFRESH_MS,
    ...homeQueryOptions,
  });
}

export function useHomeMissionsQuery() {
  return useQuery({
    queryKey: ["player", "home", "missions"],
    queryFn: async () =>
      queryPlayerApi(async () => requireReady(await loadMissions(), "Missions")),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
    retry: READY_RETRIES,
    retryDelay: READY_RETRY_DELAY_MS,
  });
}
