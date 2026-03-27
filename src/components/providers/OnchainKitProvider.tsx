"use client";

import { OnchainKitProvider as OnchainKitProviderComponent } from "@coinbase/onchainkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { env } from "@/lib/env";
import { getPlatformChain } from "@/lib/chain";
import { wagmiConfig, wagmiQueryClient } from "@/lib/wagmi/config";
import { isMiniPayRuntime } from "@/lib/client/runtime";

interface Props {
  children: React.ReactNode;
}

export function OnchainKitProvider({ children }: Props) {
  const chain = getPlatformChain(isMiniPayRuntime() ? "MINIPAY" : "FARCASTER");

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={wagmiQueryClient}>
        <OnchainKitProviderComponent
          apiKey={env.nextPublicOnchainkitApiKey}
          chain={chain}
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
