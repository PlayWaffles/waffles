"use client";

import { useQuery } from "@tanstack/react-query";
import { authenticatedFetch } from "@/lib/client/runtime";

// ==========================================
// TYPES
// ==========================================

export interface ProfileStats {
  totalGames: number;
  wins: number;
  winRate: number;
  totalWon: number;
  highestScore: number;
  avgScore: number;
  currentStreak: number;
  bestRank: number | null;
}

// ==========================================
// FETCHER
// ==========================================

async function fetchStats(url: string): Promise<ProfileStats | null> {
  const res = await authenticatedFetch(url, { cache: "no-store" });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  return res.json();
}

// ==========================================
// HOOK
// ==========================================

/**
 * Fetch profile stats with TanStack Query caching.
 * Uses public /api/v1/users/[fid]/stats endpoint.
 */
export function useProfileStats() {
  const { data, error, isLoading, refetch } = useQuery<ProfileStats | null>({
    queryKey: ["profile", "me", "stats"],
    queryFn: () => fetchStats("/api/v1/users/me/stats"),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 10000,
  });

  return {
    stats: data ?? null,
    isLoading,
    error: error ? "Failed to load stats" : null,
    refetch,
  };
}
