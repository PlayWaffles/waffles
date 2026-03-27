import { celoSepolia } from "viem/chains";
import { env } from "@/lib/env";

export const chain = celoSepolia;

export const WAFFLE_CONTRACT_ADDRESS = env.nextPublicWaffleContractAddress;

export const PAYMENT_TOKEN_ADDRESS = env.nextPublicPaymentTokenAddress;
export const PAYMENT_TOKEN_DECIMALS = 6;
export const BLOCK_EXPLORER_URL = env.nextPublicBlockExplorerUrl;
