"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";

import { WaffleButton } from "../buttons/WaffleButton";
import { getDemoQuestion, type DemoQuestion } from "@/actions/onboarding";
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

function getOnboardingKey(runtime: AppRuntime, userId?: string | null) {
  return userId
    ? `waffles:onboarded:${runtime}:${userId}`
    : `waffles:onboarded:${runtime}`;
}

export function AppInitializer({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { hideSplash } = useSplash();
  const { user, isLoading, isUnauthenticated, refetch } = useUser();

  const [authState, setAuthState] = useState<"idle" | "authenticating" | "error">("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [demoQuestion, setDemoQuestion] = useState<DemoQuestion | null>(null);
  const [demoQuestionLoaded, setDemoQuestionLoaded] = useState(false);
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [isSyncingFarcasterWallet, setIsSyncingFarcasterWallet] = useState(false);
  const [isSyncingFarcasterProfile, setIsSyncingFarcasterProfile] = useState(false);
  const [notificationNudgeDismissed, setNotificationNudgeDismissed] = useState(false);
  const [notificationNudgeError, setNotificationNudgeError] = useState<string | null>(null);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const farcasterRecoveryAttemptRef = useRef<string | null>(null);
  const farcasterProfileSyncRef = useRef<string | null>(null);
  const onboardingAuthInProgressRef = useRef(false);
  const appOpenedRef = useRef(false);
  const onboardingStartedRef = useRef<string | null>(null);
  const onboardingKey = useMemo(() => {
    if (!runtime) return null;
    if (runtime === "farcaster") {
      return getOnboardingKey(runtime, user?.id);
    }
    // Scope MiniPay/browser onboarding to wallet so different users on
    // the same device each see onboarding once.
    const walletScope = address?.toLowerCase();
    return getOnboardingKey(runtime, walletScope);
  }, [runtime, user?.id, address]);

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
    if (!runtime || typeof window === "undefined") {
      return;
    }

    const hasSeen = onboardingKey
      ? localStorage.getItem(onboardingKey) === "1"
      : false;

    if (runtime === "farcaster") {
      const shouldShow = Boolean(user) && !hasSeen;
      setShowOnboarding(shouldShow);
      if (shouldShow && onboardingKey && onboardingStartedRef.current !== onboardingKey) {
        onboardingStartedRef.current = onboardingKey;
        trackClientEvent(AnalyticsEvent.OnboardingStarted, {
          runtime,
          platform: user?.platform ?? null,
        });
      }
      return;
    }

    setShowOnboarding(!hasSeen);
    if (!hasSeen && onboardingKey && onboardingStartedRef.current !== onboardingKey) {
      onboardingStartedRef.current = onboardingKey;
      trackClientEvent(AnalyticsEvent.OnboardingStarted, {
        runtime,
        platform: runtimeToPlatform(runtime),
      });
    }
  }, [onboardingKey, runtime, user]);

  useEffect(() => {
    if (runtime !== "farcaster" || !user?.id) {
      setNotificationNudgeDismissed(false);
      setNotificationNudgeError(null);
      return;
    }

    if (user.notificationsEnabled) {
      setNotificationNudgeDismissed(false);
      setNotificationNudgeError(null);
      return;
    }

    setNotificationNudgeDismissed(false);
  }, [runtime, user?.id, user?.notificationsEnabled]);

  // Fetch the demo question in the background. The first onboarding slide does
  // not need it, so keep the pitch render path independent of this request.
  useEffect(() => {
    if (!showOnboarding || demoQuestionLoaded) return;
    getDemoQuestion()
      .then(setDemoQuestion)
      .catch(() => setDemoQuestion(null))
      .finally(() => setDemoQuestionLoaded(true));
  }, [showOnboarding, demoQuestionLoaded]);

  const authenticateWallet = useCallback(async (walletAddress: string) => {
    if (!walletAddress) return;

    setAuthState("authenticating");
    setAuthError(null);
    trackClientEvent(AnalyticsEvent.AuthStarted, {
      runtime,
      wallet: walletAddress.toLowerCase(),
    });

    try {
      const nonceRes = await authenticatedFetch(
        `/api/v1/auth/nonce?address=${encodeURIComponent(walletAddress)}`,
      );
      if (!nonceRes.ok) {
        throw new Error("Failed to start wallet authentication");
      }

      const { message } = await nonceRes.json();
      const signature = await signMessageAsync({ message });
      const verifyRes = await authenticatedFetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: walletAddress, signature }),
      });

      if (!verifyRes.ok) {
        throw new Error("Wallet signature verification failed");
      }

      await refetch();
      setAuthState("idle");
      trackClientEvent(AnalyticsEvent.AuthCompleted, {
        runtime,
        wallet: walletAddress.toLowerCase(),
      });
    } catch (error) {
      console.error("Wallet auth failed:", error);
      setAuthState("error");
      setAuthError(
        error instanceof Error ? error.message : "Wallet authentication failed",
      );
      trackClientEvent(AnalyticsEvent.AuthFailed, {
        runtime,
        wallet: walletAddress.toLowerCase(),
        reason: error instanceof Error ? error.message : "Wallet authentication failed",
      });
      throw error;
    }
  }, [refetch, runtime, signMessageAsync]);

  const connectWallet = useCallback(async () => {
    if (address && isConnected) {
      return address;
    }

    const connector =
      connectors.find((item) => item.id === "injected") || connectors[0];
    if (!connector) {
      throw new Error("No wallet connector available");
    }

    setAuthError(null);
    const connection = await connectAsync({ connector });
    const nextAddress = connection.accounts[0];

    if (!nextAddress) {
      throw new Error("Wallet address unavailable");
    }

    return nextAddress;
  }, [address, connectAsync, connectors, isConnected]);

  const markOnboardingCompleted = useCallback(async () => {
    const response = await authenticatedFetch("/api/v1/users/me/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error ?? "Failed to record onboarding completion",
      );
    }
  }, []);

  useEffect(() => {
    if (runtime !== "minipay" && runtime !== "browser") {
      return;
    }

    if (showOnboarding) {
      return;
    }

    // Prevent racing with handleOnboardingComplete which already
    // calls authenticateWallet right before flipping showOnboarding off.
    if (onboardingAuthInProgressRef.current) {
      return;
    }

    if (!isConnected || !address || !isUnauthenticated || authState !== "idle") {
      return;
    }

    authenticateWallet(address).catch(console.error);
  }, [
    address,
    authState,
    authenticateWallet,
    isConnected,
    isUnauthenticated,
    runtime,
    showOnboarding,
  ]);

  const handleOnboardingComplete = useCallback(async () => {
    if (!runtime) {
      throw new Error("Runtime unavailable");
    }

    if (runtime === "farcaster") {
      try {
        console.log("[onboarding] Calling sdk.actions.addMiniApp()");
        await sdk.actions.addMiniApp();
        console.log("[onboarding] addMiniApp() resolved (user accepted)");
      } catch (err) {
        console.log("[onboarding] addMiniApp() rejected:", err instanceof Error ? err.message : err);
      }
      setNotificationNudgeDismissed(true);
      await markOnboardingCompleted();
      trackClientEvent(AnalyticsEvent.OnboardingCompleted, {
        runtime,
        platform: user?.platform ?? null,
      });
    } else {
      onboardingAuthInProgressRef.current = true;
      try {
        const walletAddress = await connectWallet();
        await authenticateWallet(walletAddress);
        await markOnboardingCompleted();
        await refetch();
        trackClientEvent(AnalyticsEvent.OnboardingCompleted, {
          runtime,
          platform: runtimeToPlatform(runtime),
          wallet: walletAddress.toLowerCase(),
        });
      } catch (error) {
        console.error("Wallet auth during onboarding failed:", error);
        setAuthError(
          error instanceof Error ? error.message : "Wallet connection failed",
        );
        trackClientEvent(AnalyticsEvent.OnboardingFailed, {
          runtime,
          platform: runtimeToPlatform(runtime),
          reason: error instanceof Error ? error.message : "Wallet connection failed",
        });
        throw error;
      } finally {
        onboardingAuthInProgressRef.current = false;
      }
    }

    if (typeof window !== "undefined" && onboardingKey) {
      localStorage.setItem(onboardingKey, "1");
    }
    setShowOnboarding(false);
  }, [authenticateWallet, connectWallet, markOnboardingCompleted, onboardingKey, refetch, runtime, user?.platform]);

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

  useEffect(() => {
    if (runtime !== "farcaster" || !user?.id) {
      return;
    }

    const handleNotificationsEnabled = () => {
      console.log("[sdk-event] notificationsEnabled");
      setNotificationNudgeDismissed(true);
      setNotificationNudgeError(null);
      setIsEnablingNotifications(false);
      refetch().catch(console.error);
    };

    const handleMiniAppAdded = ({
      notificationDetails,
    }: {
      notificationDetails?: { token?: string; url?: string };
    }) => {
      console.log("[sdk-event] miniAppAdded", {
        hasNotificationDetails: Boolean(notificationDetails),
        hasToken: Boolean(notificationDetails?.token),
        hasUrl: Boolean(notificationDetails?.url),
      });
      if (!notificationDetails) {
        return;
      }
      handleNotificationsEnabled();
    };

    const handleMiniAppAddRejected = () => {
      console.log("[sdk-event] miniAppAddRejected");
      setNotificationNudgeDismissed(true);
      setNotificationNudgeError(null);
      setIsEnablingNotifications(false);
    };

    sdk.on("notificationsEnabled", handleNotificationsEnabled);
    sdk.on("miniAppAdded", handleMiniAppAdded);
    sdk.on("miniAppAddRejected", handleMiniAppAddRejected);

    return () => {
      sdk.off("notificationsEnabled", handleNotificationsEnabled);
      sdk.off("miniAppAdded", handleMiniAppAdded);
      sdk.off("miniAppAddRejected", handleMiniAppAddRejected);
    };
  }, [refetch, runtime, user?.id]);

  const dismissNotificationNudge = useCallback(() => {
    setNotificationNudgeDismissed(true);
    setNotificationNudgeError(null);
  }, []);

  const enableNotifications = useCallback(async () => {
    try {
      setIsEnablingNotifications(true);
      setNotificationNudgeError(null);
      await sdk.actions.addMiniApp();
      refetch().catch(console.error);
    } catch (error) {
      setIsEnablingNotifications(false);
      setNotificationNudgeError(
        error instanceof Error
          ? error.message
          : "Could not open the notifications prompt.",
      );
    }
  }, [refetch]);

  const shouldShowNotificationNudge =
    runtime === "farcaster" &&
    Boolean(user) &&
    !showOnboarding &&
    user?.notificationsEnabled === false &&
    !notificationNudgeDismissed;

  // Auth + runtime initialization runs entirely in the effects above. Rendering
  // is now unconditional — no legacy onboarding/auth-gate UI. The player
  // experience is the ported v2 app (its own onboarding + the useWalletSignIn
  // hook handle sign-in); other (app) routes just render their content. Keeps
  // the wallet/Farcaster auth machinery, drops the legacy OnboardingOverlay.
  return <>{children}</>;
}
