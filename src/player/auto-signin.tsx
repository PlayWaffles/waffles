"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@/hooks/useUser";
import { useWalletSignIn } from "@/hooks/useWalletSignIn";
import { AnalyticsEvent, trackClientEvent } from "@/lib/analytics";

/**
 * Auto wallet sign-in for the v2 app. Supported platforms: Base App + MiniPay
 * (Farcaster dropped). Both authenticate the same way — injected wallet signature
 * → session cookie (the verify route tags the platform server-side). On load, if
 * there's no session, silently sign in so real DB data flows without a button.
 *
 * Scope: only RETURNING players (already past the v2 onboarding). First-timers
 * authenticate via the onboarding SIGN UP step, so we never double-prompt the
 * wallet signature. Runs at most once per mount; silent failure (no wallet) just
 * leaves the app on local/mock state.
 */
export function AuthBootstrap() {
  const { isUnauthenticated } = useUser();
  const { signIn, signingIn } = useWalletSignIn();
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current || signingIn) return;
    if (!isUnauthenticated) {
      trackClientEvent(AnalyticsEvent.AuthAutoSigninSkipped, {
        screen: "v2",
        reason: "already_authenticated",
      });
      return;
    }

    let onboarded = false;
    try {
      onboarded = localStorage.getItem("waffles.v2.onboarded") === "1";
    } catch {
      onboarded = false;
    }
    if (!onboarded) {
      trackClientEvent(AnalyticsEvent.AuthAutoSigninSkipped, {
        screen: "v2",
        reason: "not_onboarded",
      });
      return;
    }

    tried.current = true;
    trackClientEvent(AnalyticsEvent.AuthAutoSigninStarted, { screen: "v2" });
    void signIn().then((ok) => {
      trackClientEvent(
        ok ? AnalyticsEvent.AuthAutoSigninCompleted : AnalyticsEvent.AuthAutoSigninFailed,
        { screen: "v2", reason: ok ? null : "error" },
      );
    });
  }, [isUnauthenticated, signingIn, signIn]);

  return null;
}
