"use client";

import { useEffect, useState } from "react";
import { OnchainKitProvider as OnchainKitProviderComponent } from "@coinbase/onchainkit";
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

export function OnchainKitProvider({ children }: Props) {
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);

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

  return (
    <WagmiProvider config={activeWagmiConfig}>
      <QueryClientProvider client={wagmiQueryClient}>
        <OnchainKitProviderComponent
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
        </OnchainKitProviderComponent>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
