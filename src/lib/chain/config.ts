import { base, celoSepolia } from "viem/chains";
import type { Chain } from "viem";
import { env } from "@/lib/env";
import { type ChainPlatform } from "./platform";

export const farcasterChain: Chain = {
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
export const miniPayChain = celoSepolia;

export function getPlatformChain(platform: ChainPlatform): Chain {
  return platform === "MINIPAY" ? miniPayChain : farcasterChain;
}

export function getPlatformRpcUrl(platform: ChainPlatform): string {
  return platform === "MINIPAY"
    ? miniPayChain.rpcUrls.default.http[0]
    : env.nextPublicBaseMainnetRpcUrl;
}

export function getWaffleContractAddress(
  platform: ChainPlatform,
): `0x${string}` {
  return platform === "MINIPAY"
    ? env.nextPublicWaffleContractAddressMiniPay
    : env.nextPublicWaffleContractAddressFarcaster;
}

export function getPaymentTokenAddress(platform: ChainPlatform): `0x${string}` {
  return platform === "MINIPAY"
    ? env.nextPublicPaymentTokenAddressMiniPay
    : env.nextPublicPaymentTokenAddressFarcaster;
}

export const PAYMENT_TOKEN_DECIMALS = 6;
