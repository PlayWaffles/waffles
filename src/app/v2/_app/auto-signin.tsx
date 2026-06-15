"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/hooks/useUser";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";

/**
 * Auto wallet sign-in for the v2 app (MiniPay only — Base/Farcaster are no longer
 * supported). On load, if there's no session, silently run the MiniPay wallet
 * sign-in so real DB data flows without anyone hunting for a button.
 *
 * Scope: only RETURNING players (already past the v2 onboarding). First-timers
 * authenticate via the onboarding SIGN UP step, so we never double-prompt the
 * wallet signature. Runs at most once per mount; silent failure (no wallet) just
 * leaves the app on local/mock state.
 */
export function V2AuthBootstrap() {
  const { isUnauthenticated } = useUser();
  const { signIn, signingIn } = useWalletSignIn();
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current || signingIn || !isUnauthenticated) return;

    let onboarded = false;
    try {
      onboarded = localStorage.getItem("waffles.v2.onboarded") === "1";
    } catch {
      onboarded = false;
    }
    if (!onboarded) return; // first-timers sign in via the onboarding SIGN UP step

    tried.current = true;
    void signIn();
  }, [isUnauthenticated, signingIn, signIn]);

  return null;
}
