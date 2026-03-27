/**
 * AccessGuard - Lightweight game route protection.
 *
 * Invite-code gating is no longer part of the live app flow, so this guard
 * only blocks banned users from entering the game shell.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { WaffleLoader } from "@/components/ui/WaffleLoader";

interface AccessGuardProps {
  children: React.ReactNode;
}

export function AccessGuard({ children }: AccessGuardProps) {
  const router = useRouter();
  const { user, isLoading } = useUser();

  // Redirect only when a known user has been banned.
  useEffect(() => {
    if (!isLoading && user?.isBanned) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <WaffleLoader />;
  }

  if (user?.isBanned) {
    return null;
  }

  return <>{children}</>;
}
