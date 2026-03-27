"use client";

import useSWR from "swr";
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
 * Fetch profile stats with SWR caching.
 * Uses public /api/v1/users/[fid]/stats endpoint.
 */
export function useProfileStats() {
  const { data, error, isLoading, mutate } = useSWR<ProfileStats | null>(
    "/api/v1/users/me/stats",
    fetchStats,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10000,
    }
  );

  return {
    stats: data ?? null,
    isLoading,
    error: error ? "Failed to load stats" : null,
    refetch: mutate,
  };
}
