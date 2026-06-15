"use client";

import {
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useConnect } from "wagmi";

import { useUser } from "@/hooks/useUser";
import { useSplash } from "./SplashProvider";
import {
  authenticatedFetch,
  getAppRuntime,
  isMiniPayRuntime,
  runtimeToPlatform,
  setRuntimePlatformCookie,
  type AppRuntime,
} from "@/lib/client/runtime";
import {
  AnalyticsEvent,
  captureFirstTouchAttribution,
  trackClientEvent,
} from "@/lib/analytics";

export function AppInitializer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { connectors } = useConnect();
  const { hideSplash } = useSplash();
  const { user, refetch } = useUser();

  const [showOnboarding] = useState(false);
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [isSyncingFarcasterWallet, setIsSyncingFarcasterWallet] = useState(false);
  const [isSyncingFarcasterProfile, setIsSyncingFarcasterProfile] = useState(false);
  const farcasterRecoveryAttemptRef = useRef<string | null>(null);
  const farcasterProfileSyncRef = useRef<string | null>(null);
  const appOpenedRef = useRef(false);

  // Identify user in PostHog once user data is available
  useEffect(() => {
    if (!user?.id) {
      console.info("[posthog]", "client_reset");
      import("posthog-js").then(({ default: posthog }) => posthog.reset());
      return;
    }
    console.info("[posthog]", "client_identify", {
      distinctId: user.id,
      platform: user.platform,
      username: user.username ?? null,
      fid: user.fid ?? null,
      wallet: user.wallet ?? null,
    });
    import("posthog-js").then(({ default: posthog }) => {
      posthog.identify(user.id, {
        platform: user.platform,
        username: user.username ?? undefined,
        fid: user.fid ?? undefined,
        wallet: user.wallet ?? undefined,
      });
    });
  }, [user?.id, user?.platform, user?.username, user?.fid, user?.wallet]);

  useEffect(() => {
    let mounted = true;

    async function initializeRuntime() {
      const nextRuntime = await getAppRuntime();
      if (!mounted) return;

      setRuntime(nextRuntime);
      const attribution = captureFirstTouchAttribution();
      if (!appOpenedRef.current) {
        appOpenedRef.current = true;
        trackClientEvent(AnalyticsEvent.AppOpened, {
          runtime: nextRuntime,
          path: window.location.pathname,
          ...attribution,
        });
      }

      if (nextRuntime === "farcaster") {
        try {
          await sdk.actions.ready();
        } catch (error) {
          console.warn("Farcaster ready() failed:", error);
        }
      }

      hideSplash();
    }

    initializeRuntime().catch((error) => {
      console.error("App runtime initialization failed:", error);
      setRuntime(isMiniPayRuntime() ? "minipay" : "browser");
      hideSplash();
    });

    return () => {
      mounted = false;
    };
  }, [hideSplash]);

  useEffect(() => {
    if (!runtime) return;

    const changed = setRuntimePlatformCookie(runtimeToPlatform(runtime));
    if (changed) {
      router.refresh();
    }
  }, [router, runtime]);

  useEffect(() => {
    if (!runtime || typeof window === "undefined") {
      return;
    }

    type InjectedProviderDebug = {
      isMiniPay?: boolean;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isRabby?: boolean;
      selectedAddress?: string;
      chainId?: string;
    };

    const injectedEthereum = (
      window as Window & {
        ethereum?: {
          providers?: InjectedProviderDebug[];
        };
      }
    ).ethereum as (InjectedProviderDebug & {
      providers?: InjectedProviderDebug[];
    }) | undefined;

    console.log("[runtime-debug]", {
      stage: "context-detected",
      runtime,
      context: runtime === "minipay" ? "minipay" : "browser",
      isMiniPayRuntime: runtime === "minipay",
    });

    console.log("[runtime-debug]", {
      stage: "ethereum-minipay-flag",
      runtime,
      isMiniPay: Boolean(injectedEthereum?.isMiniPay),
      rawValue: injectedEthereum?.isMiniPay ?? null,
    });

    console.log("[wallet-debug]", {
      stage: "runtime-wallets",
      runtime,
      wagmiConnectors: connectors.map((connector) => ({
        id: connector.id,
        name: connector.name,
        type: connector.type,
      })),
      injectedWallet: injectedEthereum
        ? {
            isMiniPay: Boolean(injectedEthereum.isMiniPay),
            isMetaMask: Boolean(injectedEthereum.isMetaMask),
            isCoinbaseWallet: Boolean(injectedEthereum.isCoinbaseWallet),
            isRabby: Boolean(injectedEthereum.isRabby),
            selectedAddress: injectedEthereum.selectedAddress ?? null,
            chainId: injectedEthereum.chainId ?? null,
          }
        : null,
      injectedProviders:
        injectedEthereum?.providers?.map((provider: InjectedProviderDebug, index: number) => ({
          index,
          isMiniPay: Boolean(provider.isMiniPay),
          isMetaMask: Boolean(provider.isMetaMask),
          isCoinbaseWallet: Boolean(provider.isCoinbaseWallet),
          isRabby: Boolean(provider.isRabby),
          selectedAddress: provider.selectedAddress ?? null,
          chainId: provider.chainId ?? null,
        })) ?? [],
    });
  }, [connectors, runtime]);

  useEffect(() => {
    if (
      runtime !== "farcaster" ||
      !user ||
      showOnboarding ||
      isSyncingFarcasterProfile
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const context = await sdk.context;
        if (cancelled || !context?.user) return;

        const profileFid = context.user.fid;
        if (!profileFid || (user.fid && user.fid !== profileFid)) {
          return;
        }

        const syncKey = `${user.id}:${profileFid}:${context.user.username ?? ""}:${context.user.pfpUrl ?? ""}`;
        if (farcasterProfileSyncRef.current === syncKey) return;
        farcasterProfileSyncRef.current = syncKey;

        setIsSyncingFarcasterProfile(true);

        const response = await authenticatedFetch("/api/v1/users/me/farcaster-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fid: profileFid,
            username: context.user.username ?? null,
            pfpUrl: context.user.pfpUrl ?? null,
          }),
        });

        if (!response.ok) {
          throw new Error("Farcaster profile sync failed");
        }

        if (
          !cancelled &&
          (user.username !== (context.user.username ?? null) ||
            user.pfpUrl !== (context.user.pfpUrl ?? null))
        ) {
          refetch().catch(console.error);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[farcaster-profile-sync]", error);
        }
      } finally {
        if (!cancelled) {
          setIsSyncingFarcasterProfile(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isSyncingFarcasterProfile,
    refetch,
    runtime,
    showOnboarding,
    user,
  ]);

  useEffect(() => {
    if (
      runtime !== "farcaster" ||
      !user ||
      showOnboarding ||
      isSyncingFarcasterProfile ||
      isSyncingFarcasterWallet
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider || cancelled) return;

        const existingAccounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];

        const walletAddress =
          existingAccounts[0] ||
          ((await provider.request({
            method: "eth_requestAccounts",
          })) as string[])[0];

        if (!walletAddress || cancelled) return;

        const attemptKey = `${user.id}:${walletAddress.toLowerCase()}`;
        if (farcasterRecoveryAttemptRef.current === attemptKey) return;
        farcasterRecoveryAttemptRef.current = attemptKey;

        setIsSyncingFarcasterWallet(true);
        const farcasterContext = await sdk.context.catch(() => null);

        const response = await authenticatedFetch("/api/v1/users/me/farcaster-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: walletAddress,
            username: farcasterContext?.user?.username ?? user.username ?? null,
          }),
        });

        if (!response.ok) throw new Error("Farcaster wallet sync failed");

        const result = await response.json();
        if (!cancelled && result.success) {
          refetch().catch(console.error);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[farcaster-recovery]", error);
        }
      } finally {
        if (!cancelled) {
          setIsSyncingFarcasterWallet(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isSyncingFarcasterProfile,
    isSyncingFarcasterWallet,
    refetch,
    runtime,
    showOnboarding,
    user,
  ]);

  // Auth + runtime initialization runs entirely in the effects above. Rendering
  // is now unconditional — no legacy onboarding/auth-gate UI. The player
  // experience is the ported v2 app (its own onboarding + the useWalletSignIn
  // hook handle sign-in); other (app) routes just render their content. Keeps
  // the wallet/Farcaster auth machinery, drops the legacy OnboardingOverlay.
  return <>{children}</>;
}
