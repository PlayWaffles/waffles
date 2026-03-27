import { celoSepolia } from "viem/chains";
import { env } from "@/lib/env";
import { type ChainPlatform } from "./platform";

export const chain = celoSepolia;

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

export const WAFFLE_CONTRACT_ADDRESS = getWaffleContractAddress("FARCASTER");
export const PAYMENT_TOKEN_ADDRESS = getPaymentTokenAddress("FARCASTER");
export const PAYMENT_TOKEN_DECIMALS = 6;
