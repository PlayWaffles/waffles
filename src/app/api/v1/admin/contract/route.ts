import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createPublicClient, http, formatUnits } from "viem";
import { waffleGameAbi } from "@/lib/chain/abi";
import { env } from "@/lib/env";
import {
  chain,
  PAYMENT_TOKEN_DECIMALS,
  getWaffleContractAddress,
} from "@/lib/chain";
import { assertChainPlatform } from "@/lib/chain/platform";

/**
 * Admin Contract Management API
 *
 * Provides read-only access to contract state.
 * Write operations (like setPaymentToken, withdrawFees) require the cold wallet
 * and should be done directly via the contract or a multisig.
 */

const publicClient = createPublicClient({
  chain: chain,
  transport: http(),
});

// Auth check using existing session system
async function isAuthorized(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

interface ContractState {
  address: string;
  chain: string;
  chainId: number;
  token: {
    address: string;
    symbol: string;
    decimals: number;
  };
  platformFeeBps: number;
  platformFeePercent: string;
  accumulatedFees: string;
  accumulatedFeesFormatted: string;
  activeGameCount: number;
  isPaused: boolean;
  settlementWalletConfigured: boolean;
}

/**
 * GET /api/v1/admin/contract
 *
 * Fetch current contract state
 */
export async function GET(request: NextRequest) {
  // Auth check
  if (!(await isAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = assertChainPlatform(
      searchParams.get("platform") ?? "FARCASTER",
    );
    const contractAddress = getWaffleContractAddress(platform);

    // Fetch contract state in parallel
    const [
      tokenAddress,
      platformFeeBps,
      accumulatedFees,
      activeGameCount,
      isPaused,
    ] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "paymentToken",
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "platformFeePermyriad",
      }) as Promise<number>,
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "accumulatedFees",
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "activeGameCount",
      }) as Promise<bigint>,
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "paused",
      }) as Promise<boolean>,
    ]);

    // Check if wallet is configured
    const isConfigured = !!env.operatorPrivateKey && !!env.settlerPrivateKey;
    // let address = null;
    // let balance = null;

    const state: ContractState = {
      address: contractAddress,
      chain: chain.name,
      chainId: chain.id,
      token: {
        address: tokenAddress,
        symbol: "USDC",
        decimals: PAYMENT_TOKEN_DECIMALS,
      },
      platformFeeBps: Number(platformFeeBps),
      platformFeePercent: (Number(platformFeeBps) / 100).toFixed(2),
      accumulatedFees: accumulatedFees.toString(),
      accumulatedFeesFormatted: formatUnits(
        accumulatedFees,
        PAYMENT_TOKEN_DECIMALS,
      ),
      activeGameCount: Number(activeGameCount),
      isPaused,
      settlementWalletConfigured: isConfigured,
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error("[Contract API] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch contract state",
      },
      { status: 500 },
    );
  }
}
