import { base, baseSepolia, celoSepolia } from "viem/chains";
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
export const miniPayChain = celoSepolia;

export function getPlatformChain(target: ChainTarget): Chain {
  const { network } = resolveChainTarget(target);
  if (network === "BASE_SEPOLIA") return farcasterSepoliaChain;
  if (network === "CELO_SEPOLIA") return miniPayChain;
  return farcasterMainnetChain;
}

export function getPlatformRpcUrl(target: ChainTarget): string {
  const { network } = resolveChainTarget(target);
  if (network === "BASE_SEPOLIA") return env.nextPublicBaseSepoliaRpcUrl;
  if (network === "CELO_SEPOLIA") return miniPayChain.rpcUrls.default.http[0];
  return env.nextPublicBaseMainnetRpcUrl;
}

export function getWaffleContractAddress(
  target: ChainTarget,
): `0x${string}` {
  const { platform } = resolveChainTarget(target);
  return platform === "MINIPAY"
    ? env.nextPublicWaffleContractAddressMiniPay
    : env.nextPublicWaffleContractAddressFarcaster;
}

export function getPaymentTokenAddress(target: ChainTarget): `0x${string}` {
  const { platform } = resolveChainTarget(target);
  return platform === "MINIPAY"
    ? env.nextPublicPaymentTokenAddressMiniPay
    : env.nextPublicPaymentTokenAddressFarcaster;
}

export const PAYMENT_TOKEN_DECIMALS = 6;
