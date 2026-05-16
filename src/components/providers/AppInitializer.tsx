"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import sdk from "@farcaster/miniapp-sdk";
import { useRouter } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";

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

const OnboardingOverlay = dynamic(
  () => import("../OnboardingOverlay").then((mod) => mod.OnboardingOverlay),
  { ssr: false },
);

function ProviderActionButton({
  children,
  className = "",
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`relative flex h-[54px] w-full items-center justify-center rounded-[12px] border-[5px] border-l-0 border-t-0 border-(--brand-cyan) bg-white px-6 text-center font-body text-[26px] font-normal uppercase leading-[115%] tracking-[-0.02em] text-[#191919] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function IntroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-body text-[22px] leading-none text-waffle-gold">
        {value}
      </span>
      <span className="mt-1 font-display text-[11px] uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
    </div>
  );
}

function FastOnboardingIntro({ onNext }: { onNext: () => void }) {
  return (
    <div
      className="fixed inset-0 z-81 flex flex-col app-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fast-onboarding-title"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="font-body text-sm tracking-[0.08em] text-white">
          WAFFLES
        </div>
        <div className="h-1.5 w-10 rounded-full bg-waffle-gold" />
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="flex w-full max-w-[320px] flex-col items-center gap-8">
          <div className="relative h-[126px] w-[190px] rotate-[-8deg] rounded-[18px] border-[6px] border-[#FFC931] bg-[#F7A928] shadow-[0_8px_0_rgba(0,0,0,0.35)]">
            <div className="absolute left-0 right-0 top-0 h-9 rounded-t-[10px] bg-[#2A2A2E]">
              <div className="grid h-full grid-cols-5 gap-1 p-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="skew-x-[-18deg] rounded-sm bg-white/85"
                  />
                ))}
              </div>
            </div>
            <div className="absolute inset-x-4 bottom-5 grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, index) => (
                <span
                  key={index}
                  className="h-4 rounded-[4px] bg-[#9B5B11]/70"
                />
              ))}
            </div>
            <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[10px] border-4 border-[#1E1E1E] bg-[#FFC931] font-body text-2xl text-[#1E1E1E]">
              ?
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <h1
              id="fast-onboarding-title"
              className="text-center font-body leading-[0.92] tracking-[-0.03em] text-white"
              style={{ fontSize: "clamp(36px, 10vw, 48px)" }}
            >
              GUESS THE SCENE.
              <br />
              <span className="text-waffle-gold">WIN THE POT.</span>
            </h1>
            <p className="max-w-[280px] text-center font-display text-[15px] leading-[1.4] text-white/50">
              AI-remixed movie scenes. Live arena. Top scorers split the prize pool.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <IntroStat value="3x" label="per week" />
            <div className="h-8 w-px bg-white/10" />
            <IntroStat value="TOP 10" label="split the pot" />
            <div className="h-8 w-px bg-white/10" />
            <IntroStat value="60s" label="per question" />
          </div>

          <ProviderActionButton onClick={onNext}>TRY A QUESTION</ProviderActionButton>
        </div>
      </div>
    </div>
  );
}

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
  const [showFullOnboarding, setShowFullOnboarding] = useState(false);
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
      if (!shouldShow) setShowFullOnboarding(false);
      return;
    }

    setShowOnboarding(!hasSeen);
    if (hasSeen) setShowFullOnboarding(false);
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
    } catch (error) {
      console.error("Wallet auth failed:", error);
      setAuthState("error");
      setAuthError(
        error instanceof Error ? error.message : "Wallet authentication failed",
      );
      throw error;
    }
  }, [refetch, signMessageAsync]);

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
    if (runtime === "farcaster") {
      try {
        console.log("[onboarding] Calling sdk.actions.addMiniApp()");
        await sdk.actions.addMiniApp();
        console.log("[onboarding] addMiniApp() resolved (user accepted)");
      } catch (err) {
        console.log("[onboarding] addMiniApp() rejected:", err instanceof Error ? err.message : err);
      }
      setNotificationNudgeDismissed(true);
    } else {
      onboardingAuthInProgressRef.current = true;
      try {
        const walletAddress = await connectWallet();
        await authenticateWallet(walletAddress);
        await refetch();
      } catch (error) {
        console.error("Wallet auth during onboarding failed:", error);
        setAuthError(
          error instanceof Error ? error.message : "Wallet connection failed",
        );
        throw error;
      } finally {
        onboardingAuthInProgressRef.current = false;
      }
    }

    if (typeof window !== "undefined" && onboardingKey) {
      localStorage.setItem(onboardingKey, "1");
    }
    setShowOnboarding(false);
    setShowFullOnboarding(false);
  }, [authenticateWallet, connectWallet, onboardingKey, refetch, runtime]);

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

  if (!runtime) {
    return null;
  }

  if (runtime === "farcaster") {
    if (isLoading) {
      return null;
    }

    if (!user) {
      return (
        <div className="fixed inset-0 z-80 flex items-center justify-center app-background px-4">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/70 p-6 text-center">
            <h2 className="font-body text-3xl text-white">Authentication needed</h2>
            <p className="mt-3 font-display text-sm text-white/60">
              Open Waffles inside Farcaster to continue with your Farcaster profile.
            </p>
            <ProviderActionButton
              className="mt-6 w-full"
              onClick={() => refetch().catch(console.error)}
            >
              Retry
            </ProviderActionButton>
          </div>
        </div>
      );
    }

    if (showOnboarding) {
      if (!showFullOnboarding) {
        return <FastOnboardingIntro onNext={() => setShowFullOnboarding(true)} />;
      }

      return (
        <OnboardingOverlay
          onComplete={handleOnboardingComplete}
          errorMessage={authError}
          demoQuestion={demoQuestion}
        />
      );
    }

    return (
      <>
        {children}
        {shouldShowNotificationNudge ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-70 flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-md rounded-[28px] border border-white/10 bg-black/80 p-4 shadow-2xl backdrop-blur">
              <div className="space-y-2">
                <p className="font-body text-2xl text-white">Turn on alerts</p>
                <p className="text-sm text-white/65">
                  Get nudges for tickets, almost sold out games, live updates, and results in Farcaster.
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <ProviderActionButton
                  className="h-12 max-w-none border-(--brand-cyan) px-4 text-base"
                  onClick={() => enableNotifications().catch(console.error)}
                  disabled={isEnablingNotifications}
                >
                  {isEnablingNotifications ? "Opening..." : "Enable Notifications"}
                </ProviderActionButton>
                <button
                  type="button"
                  className="text-sm text-white/60 underline"
                  onClick={dismissNotificationNudge}
                >
                  Not now
                </button>
                {notificationNudgeError ? (
                  <p className="text-sm text-red-300">{notificationNudgeError}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (showOnboarding) {
    if (!showFullOnboarding) {
      return <FastOnboardingIntro onNext={() => setShowFullOnboarding(true)} />;
    }

    return (
      <OnboardingOverlay
        onComplete={handleOnboardingComplete}
        errorMessage={authError}
        demoQuestion={demoQuestion}
      />
    );
  }

  if (authState === "authenticating" || isLoading) {
    return null;
  }

  if (!user) {
    return (
      <div className="fixed inset-0 z-80 flex items-center justify-center app-background px-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/70 p-6 text-center">
          <h2 className="font-body text-3xl text-white">Authentication needed</h2>
          <p className="mt-3 font-display text-sm text-white/60">
            Sign the wallet message to continue into the MiniPay app.
          </p>
          <ProviderActionButton
            className="mt-6 w-full"
            onClick={async () => {
              try {
                const walletAddress = await connectWallet();
                await authenticateWallet(walletAddress);
              } catch (error) {
                console.error(error);
              }
            }}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Retry Sign-In"}
          </ProviderActionButton>
          <button
            className="mt-3 text-sm text-white/60 underline"
            onClick={() => disconnect()}
          >
            Disconnect wallet
          </button>
          {authError ? (
            <p className="mt-3 text-sm text-red-300">{authError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
