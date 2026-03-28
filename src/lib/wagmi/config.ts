"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, cookieStorage, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

import { farcasterChain, getPlatformRpcUrl, miniPayChain } from "@/lib/chain";
import { env } from "@/lib/env";

const appName = "Waffles";

function createWafflesWagmiConfig(includeInjected: boolean) {
  return createConfig({
    chains: [farcasterChain, miniPayChain],
    connectors: [
      ...(includeInjected ? [injected()] : []),
      coinbaseWallet({
        appName,
        preference: "all",
      }),
    ],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [farcasterChain.id]: http(getPlatformRpcUrl("FARCASTER")),
      [miniPayChain.id]: http(getPlatformRpcUrl("MINIPAY")),
    },
  });
}

export const wagmiConfig = createWafflesWagmiConfig(true);
export const farcasterWagmiConfig = createConfig({
  chains: [farcasterChain, miniPayChain],
  connectors: [farcasterMiniApp()],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [farcasterChain.id]: http(getPlatformRpcUrl("FARCASTER")),
    [miniPayChain.id]: http(getPlatformRpcUrl("MINIPAY")),
  },
});
export const miniPayWagmiConfig = wagmiConfig;

export const wagmiQueryClient = new QueryClient();
