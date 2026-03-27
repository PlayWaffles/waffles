"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, cookieStorage, http } from "wagmi";
import { coinbaseWallet, injected } from "wagmi/connectors";

import { chain } from "@/lib/chain";
import { env } from "@/lib/env";

const appName = "Waffles";

export const wagmiConfig = createConfig({
  chains: [chain],
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
    [chain.id]: http(chain.rpcUrls.default.http[0]),
  },
});

export const wagmiQueryClient = new QueryClient();
