"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, cookieStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

import { farcasterChain, farcasterSepoliaChainConfig, getPlatformRpcUrl, miniPayChain } from "@/lib/chain";
import { env } from "@/lib/env";

function createWafflesWagmiConfig(includeInjected: boolean) {
  return createConfig({
    chains: [farcasterChain, farcasterSepoliaChainConfig, miniPayChain],
    connectors: includeInjected ? [injected()] : [],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [farcasterChain.id]: http(getPlatformRpcUrl("FARCASTER")),
      [farcasterSepoliaChainConfig.id]: http(getPlatformRpcUrl({ platform: "FARCASTER", network: "BASE_SEPOLIA" })),
      [miniPayChain.id]: http(getPlatformRpcUrl("MINIPAY")),
    },
  });
}

export const wagmiConfig = createWafflesWagmiConfig(true);
export const farcasterWagmiConfig = createConfig({
  chains: [farcasterChain, farcasterSepoliaChainConfig, miniPayChain],
  connectors: [farcasterMiniApp()],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [farcasterChain.id]: http(getPlatformRpcUrl("FARCASTER")),
    [farcasterSepoliaChainConfig.id]: http(getPlatformRpcUrl({ platform: "FARCASTER", network: "BASE_SEPOLIA" })),
    [miniPayChain.id]: http(getPlatformRpcUrl("MINIPAY")),
  },
});
export const miniPayWagmiConfig = wagmiConfig;

export const wagmiQueryClient = new QueryClient();
