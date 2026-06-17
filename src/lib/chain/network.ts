import type { ChainPlatform } from "./platform";

export type GameNetwork =
  | "BASE_MAINNET"
  | "BASE_SEPOLIA"
  | "CELO_MAINNET"
  | "CELO_SEPOLIA";

export type ChainTarget =
  | ChainPlatform
  | {
      platform: ChainPlatform;
      network?: GameNetwork | null;
    };

export function defaultNetworkForPlatform(platform: ChainPlatform): GameNetwork {
  const useTestnet = process.env.NEXT_PUBLIC_CHAIN_NETWORK === "testnet";
  if (platform === "MINIPAY") {
    return useTestnet ? "CELO_SEPOLIA" : "CELO_MAINNET";
  }

  return useTestnet ? "BASE_SEPOLIA" : "BASE_MAINNET";
}

export function isTestnetNetwork(network: GameNetwork): boolean {
  return network === "BASE_SEPOLIA" || network === "CELO_SEPOLIA";
}

export function resolveChainTarget(target: ChainTarget): {
  platform: ChainPlatform;
  network: GameNetwork;
} {
  if (typeof target === "string") {
    return {
      platform: target,
      network: defaultNetworkForPlatform(target),
    };
  }

  return {
    platform: target.platform,
    network: target.network ?? defaultNetworkForPlatform(target.platform),
  };
}
