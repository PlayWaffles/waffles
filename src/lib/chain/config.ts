import { base, baseSepolia, celo, celoSepolia } from "viem/chains";
import type { Chain } from "viem";
import { env } from "@/lib/env";
import { type ChainTarget, resolveChainTarget } from "./network";

const farcasterMainnetChain: Chain = {
  ...base,
  rpcUrls: {
    ...base.rpcUrls,
    default: {
      http: [env.nextPublicBaseMainnetRpcUrl],
    },
    public: {
      http: [env.nextPublicBaseMainnetRpcUrl],
    },
  },
};
const farcasterSepoliaChain: Chain = {
  ...baseSepolia,
  rpcUrls: {
    ...baseSepolia.rpcUrls,
    default: {
      http: [env.nextPublicBaseSepoliaRpcUrl],
    },
    public: {
      http: [env.nextPublicBaseSepoliaRpcUrl],
    },
  },
};
export const farcasterChain = farcasterMainnetChain;
export const farcasterSepoliaChainConfig = farcasterSepoliaChain;
export const miniPayChain = celo;
export const miniPaySepoliaChain = celoSepolia;

export function getPlatformChain(target: ChainTarget): Chain {
  const { network } = resolveChainTarget(target);
  if (network === "BASE_SEPOLIA") return farcasterSepoliaChain;
  if (network === "CELO_MAINNET") return miniPayChain;
  if (network === "CELO_SEPOLIA") return miniPaySepoliaChain;
  return farcasterMainnetChain;
}

export function getPlatformRpcUrl(target: ChainTarget): string {
  const { network } = resolveChainTarget(target);
  if (network === "BASE_SEPOLIA") return env.nextPublicBaseSepoliaRpcUrl;
  if (network === "CELO_MAINNET") {
    return env.nextPublicCeloMainnetRpcUrl || miniPayChain.rpcUrls.default.http[0];
  }
  if (network === "CELO_SEPOLIA") return miniPaySepoliaChain.rpcUrls.default.http[0];
  return env.nextPublicBaseMainnetRpcUrl;
}

export function getWaffleContractAddress(
  target: ChainTarget,
): `0x${string}` {
  const { platform } = resolveChainTarget(target);
  if (platform === "BASE_APP") {
    return env.nextPublicWaffleContractAddressBaseApp;
  }
  return platform === "MINIPAY"
    ? env.nextPublicWaffleContractAddressMiniPay
    : env.nextPublicWaffleContractAddressFarcaster;
}

export function getPaymentTokenAddress(target: ChainTarget): `0x${string}` {
  const { platform, network } = resolveChainTarget(target);
  if (platform === "BASE_APP") {
    return env.nextPublicPaymentTokenAddressBaseApp;
  }
  if (platform === "MINIPAY") {
    return env.nextPublicPaymentTokenAddressMiniPay;
  }

  if (network === "BASE_SEPOLIA") {
    return env.nextPublicPaymentTokenAddressBaseSepolia;
  }

  return env.nextPublicPaymentTokenAddressBaseMainnet;
}

export const PAYMENT_TOKEN_DECIMALS = 6;
