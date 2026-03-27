"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { authenticatedFetch } from "@/lib/client/runtime";

// ==========================================
// TYPES
// ==========================================

export interface ProfileGame {
  id: number;
  gameId: string;
  score: number;
  rank: number;
  prize: number;
  paidAt: string | null;
  claimedAt: string | null;
  answeredQuestions: number;
  game: {
    id: number;
    gameNumber: number;
    onchainId: string | null;
    title: string;
    theme: string;
    startsAt: string;
    endsAt: string;
    prizePool: number;
    totalQuestions: number;
    playersCount: number;
  };
}

// ==========================================
// FETCHER
// ==========================================

async function fetchGames(url: string): Promise<ProfileGame[]> {
  const res = await authenticatedFetch(url, { cache: "no-store" });

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch games: ${res.status}`);
  }

  return res.json();
}

// ==========================================
// HOOK
// ==========================================

/** Fetch user's game history with SWR caching. */
export function useProfileGames(limit?: number) {
  const { data, error, isLoading, mutate } = useSWR<ProfileGame[]>(
    "/api/v1/users/me/games",
    fetchGames,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10000,
    }
  );

  const endedGames = useMemo(
    () => (data ?? []).filter((g) => new Date(g.game.endsAt).getTime() < Date.now()),
    [data],
  );

  const limitedGames = limit ? endedGames.slice(0, limit) : endedGames;

  return {
    games: limitedGames,
    isLoading,
    error: error ? "Failed to load games" : null,
    refetch: mutate,
  };
}
