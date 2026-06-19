"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, cookieStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

import {
  farcasterChain,
  farcasterSepoliaChainConfig,
  getPlatformRpcUrl,
  miniPayChain,
  miniPaySepoliaChain,
} from "@/lib/chain";

function createWafflesWagmiConfig(includeInjected: boolean) {
  return createConfig({
    chains: [farcasterChain, farcasterSepoliaChainConfig, miniPayChain, miniPaySepoliaChain],
    connectors: includeInjected ? [injected()] : [],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [farcasterChain.id]: http(getPlatformRpcUrl("FARCASTER")),
      [farcasterSepoliaChainConfig.id]: http(getPlatformRpcUrl({ platform: "FARCASTER", network: "BASE_SEPOLIA" })),
      [miniPayChain.id]: http(getPlatformRpcUrl("MINIPAY")),
      [miniPaySepoliaChain.id]: http(getPlatformRpcUrl({ platform: "MINIPAY", network: "CELO_SEPOLIA" })),
    },
  });
}

export const wagmiConfig = createWafflesWagmiConfig(true);
export const farcasterWagmiConfig = createConfig({
  chains: [farcasterChain, farcasterSepoliaChainConfig, miniPayChain, miniPaySepoliaChain],
  connectors: [farcasterMiniApp()],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [farcasterChain.id]: http(getPlatformRpcUrl("FARCASTER")),
    [farcasterSepoliaChainConfig.id]: http(getPlatformRpcUrl({ platform: "FARCASTER", network: "BASE_SEPOLIA" })),
    [miniPayChain.id]: http(getPlatformRpcUrl("MINIPAY")),
    [miniPaySepoliaChain.id]: http(getPlatformRpcUrl({ platform: "MINIPAY", network: "CELO_SEPOLIA" })),
  },
});
export const miniPayWagmiConfig = wagmiConfig;

export const wagmiQueryClient = new QueryClient();
