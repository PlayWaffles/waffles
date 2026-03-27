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

import { OnboardingOverlay } from "../OnboardingOverlay";
import { WaffleButton } from "../buttons/WaffleButton";
import { syncFarcasterWalletAndRecover } from "@/actions/users";
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
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [isSyncingFarcasterWallet, setIsSyncingFarcasterWallet] = useState(false);
  const farcasterRecoveryAttemptRef = useRef<string | null>(null);
  const onboardingKey = useMemo(() => {
    if (!runtime) return null;
    return runtime === "farcaster"
      ? getOnboardingKey(runtime, user?.id)
      : getOnboardingKey(runtime);
  }, [runtime, user?.id]);

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
      setShowOnboarding(Boolean(user) && !hasSeen);
      return;
    }

    setShowOnboarding(!hasSeen);
  }, [onboardingKey, runtime, user]);

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
    if (runtime !== "farcaster") {
      const walletAddress = await connectWallet();
      await authenticateWallet(walletAddress);
      await refetch();
    }

    if (typeof window !== "undefined" && onboardingKey) {
      localStorage.setItem(onboardingKey, "1");
    }
    setShowOnboarding(false);
  }, [authenticateWallet, connectWallet, onboardingKey, refetch, runtime]);

  useEffect(() => {
    if (
      runtime !== "farcaster" ||
      !user ||
      !address ||
      isSyncingFarcasterWallet
    ) {
      return;
    }

    const attemptKey = `${user.id}:${address.toLowerCase()}`;
    if (farcasterRecoveryAttemptRef.current === attemptKey) {
      return;
    }

    let cancelled = false;
    farcasterRecoveryAttemptRef.current = attemptKey;
    setIsSyncingFarcasterWallet(true);

    syncFarcasterWalletAndRecover(address)
      .then((result) => {
        if (!cancelled && result.success) {
          refetch().catch(console.error);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Farcaster wallet sync failed:", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSyncingFarcasterWallet(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, isSyncingFarcasterWallet, refetch, runtime, user]);

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
            <WaffleButton
              className="mt-6 w-full"
              onClick={() => refetch().catch(console.error)}
            >
              Retry
            </WaffleButton>
          </div>
        </div>
      );
    }

    if (showOnboarding) {
      return (
        <OnboardingOverlay
          onComplete={handleOnboardingComplete}
          errorMessage={authError}
        />
      );
    }

    return <>{children}</>;
  }

  if (showOnboarding) {
    return (
      <OnboardingOverlay
        onComplete={handleOnboardingComplete}
        errorMessage={authError}
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
          <WaffleButton
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
          </WaffleButton>
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
