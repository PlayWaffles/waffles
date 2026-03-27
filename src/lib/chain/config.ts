import { baseSepolia, celoSepolia } from "viem/chains";
import type { Chain } from "viem";
import { env } from "@/lib/env";
import { type ChainPlatform } from "./platform";

export const farcasterChain = baseSepolia;
export const miniPayChain = celoSepolia;

export function getPlatformChain(platform: ChainPlatform): Chain {
  return platform === "MINIPAY" ? miniPayChain : farcasterChain;
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
