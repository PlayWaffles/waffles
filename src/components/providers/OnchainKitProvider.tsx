"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { env } from "@/lib/env";
import { getPlatformChain } from "@/lib/chain";
import {
  farcasterWagmiConfig,
  miniPayWagmiConfig,
  wagmiConfig,
  wagmiQueryClient,
} from "@/lib/wagmi/config";
import { getAppRuntime, type AppRuntime } from "@/lib/client/runtime";

interface Props {
  children: React.ReactNode;
}

type OnchainKitComponent = ComponentType<{
  apiKey?: string;
  chain: ReturnType<typeof getPlatformChain>;
  miniKit?: { enabled?: boolean; autoConnect?: boolean };
  config?: {
    appearance?: { mode?: "light" | "dark" | "auto" };
    wallet?: { display?: "modal" | "classic"; termsUrl?: string };
  };
  children: ReactNode;
}>;

export function OnchainKitProvider({ children }: Props) {
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const [OnchainKitRuntimeProvider, setOnchainKitRuntimeProvider] =
    useState<OnchainKitComponent | null>(null);

  useEffect(() => {
    let cancelled = false;

    getAppRuntime()
      .then((nextRuntime) => {
        if (!cancelled) {
          setRuntime(nextRuntime);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRuntime("browser");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtime || runtime === "minipay") return;

    let cancelled = false;
    import("@coinbase/onchainkit").then((mod) => {
      if (!cancelled) {
        setOnchainKitRuntimeProvider(() => mod.OnchainKitProvider);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  if (!runtime) {
    return null;
  }

  const chain = getPlatformChain(
    runtime === "farcaster"
      ? "FARCASTER"
      : runtime === "minipay"
        ? "MINIPAY"
        : "BASE_APP",
  );
  const activeWagmiConfig =
    runtime === "farcaster"
      ? farcasterWagmiConfig
      : runtime === "minipay"
        ? miniPayWagmiConfig
        : wagmiConfig;

  const app = runtime === "minipay" || !OnchainKitRuntimeProvider ? (
    children
  ) : (
    <OnchainKitRuntimeProvider
      apiKey={env.nextPublicOnchainkitApiKey}
      chain={chain}
      miniKit={{
        enabled: runtime === "farcaster",
        autoConnect: runtime === "farcaster",
      }}
      config={{
        appearance: {
          mode: "dark",
        },
        wallet: {
          display: "modal",
          termsUrl: `${env.rootUrl}/terms`,
        },
      }}
    >
      {children}
    </OnchainKitRuntimeProvider>
  );

  return (
    <WagmiProvider config={activeWagmiConfig}>
      <QueryClientProvider client={wagmiQueryClient}>{app}</QueryClientProvider>
    </WagmiProvider>
  );
}
