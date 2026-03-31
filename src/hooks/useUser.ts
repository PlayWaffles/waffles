"use client";

import useSWR from "swr";
import { authenticatedFetch } from "@/lib/client/runtime";
import type { UserPlatform } from "@prisma";

// ==========================================
// TYPES
// ==========================================

export interface UserData {
  id: string;
  platform: UserPlatform;
  fid: number | null;
  username: string | null;
  pfpUrl: string | null;
  wallet: string | null;
  notificationsEnabled: boolean;
  inviteQuota: number;
  inviteCode: string;
  hasGameAccess: boolean;
  isBanned: boolean;
  createdAt: Date;
  invitesCount: number;
}

// ==========================================
// FETCHER
// ==========================================

async function fetchUser(url: string): Promise<UserData | null> {
  const res = await authenticatedFetch(url, { cache: "no-store" });

  if (res.status === 401 || res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Failed to fetch user: ${res.status}`);
  }

  return res.json();
}

// ==========================================
// HOOK: useUser
// ==========================================

/**
 * Fetch current user data with SWR.
 * - Global cache: all components share the same data
 * - Deduplication: multiple calls = single request
 *
 * Loading is true when:
 * - MiniKit context hasn't provided FID yet, OR
 * - SWR is fetching user data
 */
export function useUser() {
  const { data, error, isLoading: swrLoading, mutate } = useSWR<UserData | null>(
    "/api/v1/users/me",
    fetchUser,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    }
  );

  return {
    user: data ?? null,
    isLoading: swrLoading,
    error: error ? "Failed to load user" : null,
    isUnauthenticated: !swrLoading && !data && !error,
    refetch: mutate,
  };
}
