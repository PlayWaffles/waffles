"use client";

import { useQuery } from "@tanstack/react-query";
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

/** Fetch user's game history with TanStack Query caching. */
export function useProfileGames(limit?: number) {
  const { data, error, isLoading, refetch } = useQuery<ProfileGame[], Error, ProfileGame[]>({
    queryKey: ["profile", "me", "games"],
    queryFn: () => fetchGames("/api/v1/users/me/games"),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 10000,
    select: (games) => {
      const now = Date.now();
      const endedGames = games.filter((g) => new Date(g.game.endsAt).getTime() < now);
      return limit ? endedGames.slice(0, limit) : endedGames;
    },
  });

  return {
    games: data ?? [],
    isLoading,
    error: error ? "Failed to load games" : null,
    refetch,
  };
}
