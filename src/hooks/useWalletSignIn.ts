"use client";

import { useCallback, useState } from "react";
import { useAccount, useConnect, useSignMessage } from "wagmi";

import { useUser } from "@/hooks/useUser";
import { authenticatedFetch } from "@/lib/client/runtime";

/**
 * Wallet sign-in for the v2 app's own onboarding (the "SIGN UP" step).
 *
 * Extracted verbatim from the (now-removed) legacy AppInitializer/OnboardingOverlay
 * flow: connect the injected wallet → fetch a nonce → sign it → verify → establish
 * the session, then refetch the current user. This is what makes the v2 server
 * actions (loadV2State, etc.) resolve a real user instead of returning 401/mock.
 */
export function useWalletSignIn() {
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { refetch } = useUser();

  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (): Promise<boolean> => {
    setSigningIn(true);
    setError(null);
    try {
      // 1. Ensure a wallet is connected. Base App + MiniPay both use the injected
      //    connector (the Farcaster connector is a separate, now-unused config).
      let wallet = isConnected ? address : undefined;
      if (!wallet) {
        const connector = connectors.find((c) => c.id === "injected") || connectors[0];
        if (!connector) throw new Error("No wallet connector available");
        const connection = await connectAsync({ connector });
        wallet = connection.accounts[0];
      }
      if (!wallet) throw new Error("Wallet address unavailable");

      // 2. Nonce → sign → verify → session cookie.
      const nonceRes = await authenticatedFetch(
        `/api/v1/auth/nonce?address=${encodeURIComponent(wallet)}`,
      );
      if (!nonceRes.ok) throw new Error("Failed to start wallet authentication");
      const { message } = await nonceRes.json();
      const signature = await signMessageAsync({ message });
      const verifyRes = await authenticatedFetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet, signature }),
      });
      if (!verifyRes.ok) throw new Error("Wallet signature verification failed");

      // 3. Refresh the current-user query so the app sees the session.
      await refetch();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet authentication failed");
      return false;
    } finally {
      setSigningIn(false);
    }
  }, [address, isConnected, connectAsync, connectors, signMessageAsync, refetch]);

  return { signIn, signingIn, error, isConnected, address };
}
