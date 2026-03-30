import type { ChainPlatform } from "./platform";

export type GameNetwork =
  | "BASE_MAINNET"
  | "BASE_SEPOLIA"
  | "CELO_SEPOLIA";

export type ChainTarget =
  | ChainPlatform
  | {
      platform: ChainPlatform;
      network?: GameNetwork | null;
    };

export function defaultNetworkForPlatform(platform: ChainPlatform): GameNetwork {
  return platform === "MINIPAY" ? "CELO_SEPOLIA" : "BASE_MAINNET";
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
