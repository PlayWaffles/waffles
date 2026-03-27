"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, cookieStorage, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";

import { farcasterChain, miniPayChain } from "@/lib/chain";
import { env } from "@/lib/env";

const appName = "Waffles";

export const wagmiConfig = createConfig({
  chains: [farcasterChain, miniPayChain],
  connectors: [
    injected(),
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
    [farcasterChain.id]: http(farcasterChain.rpcUrls.default.http[0]),
    [miniPayChain.id]: http(miniPayChain.rpcUrls.default.http[0]),
  },
});

export const wagmiQueryClient = new QueryClient();
