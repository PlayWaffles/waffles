"use client";

import { useQuery } from "@tanstack/react-query";
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
 * Fetch current user data with TanStack Query.
 * - Global cache: all components share the same data
 * - Deduplication: multiple calls = single request
 *
 * Loading is true while the initial user request is in flight.
 */
export function useUser() {
  const { data, error, isLoading, refetch } = useQuery<UserData | null>({
    queryKey: ["user", "me"],
    queryFn: () => fetchUser("/api/v1/users/me"),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 5000,
  });

  return {
    user: data ?? null,
    isLoading,
    error: error ? "Failed to load user" : null,
    isUnauthenticated: !isLoading && !data && !error,
    refetch,
  };
}
