import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { formatUnits } from "viem";
import { waffleGameAbi } from "@/lib/chain/abi";
import { env, getTreasuryWalletForPlatform } from "@/lib/env";
import {
  PAYMENT_TOKEN_DECIMALS,
  getPlatformChain,
  getWaffleContractAddress,
} from "@/lib/chain";
import { getPublicClient } from "@/lib/chain/client";
import type { ChainPlatform } from "@/lib/chain/platform";
import { resolveChainTarget } from "@/lib/chain/network";
import { getPaymentTokenSymbolForTarget } from "@/lib/chain/token-display";
import { trackServerEvent } from "@/lib/server-analytics";

type AdminContractPlatform = Extract<ChainPlatform, "BASE_APP" | "MINIPAY">;

function parseAdminContractPlatform(value: string | null): AdminContractPlatform {
  if (!value || value === "BASE_APP") return "BASE_APP";
  if (value === "MINIPAY") return "MINIPAY";
  throw new Error("Admin contract management supports only BASE_APP or MINIPAY.");
}

function getExplorer(network: ReturnType<typeof resolveChainTarget>["network"]) {
  if (network === "BASE_MAINNET") {
    return { name: "Basescan", baseUrl: "https://basescan.org" };
  }
  if (network === "BASE_SEPOLIA") {
    return { name: "Base Sepolia Explorer", baseUrl: "https://sepolia.basescan.org" };
  }
  if (network === "CELO_MAINNET") {
    return { name: "Celoscan", baseUrl: "https://celoscan.io" };
  }
  return { name: "Celo Sepolia Explorer", baseUrl: "https://celo-sepolia.blockscout.com" };
}

/**
 * Admin Contract Management API
 *
 * Provides read-only access to contract state.
 * Write operations (like setPaymentToken, withdrawFees) require the cold wallet
 * and should be done directly via the contract or a multisig.
 */

// Auth check using existing session system
async function isAuthorized(): Promise<boolean> {
  const session = await getAdminSession();
  return session !== null;
}

interface ContractState {
  platform: AdminContractPlatform;
  network: string;
  address: string;
  chain: string;
  chainId: number;
  explorerName: string;
  explorerBaseUrl: string;
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
  adminWalletConfigured: boolean;
  treasuryWallet: string;
}

/**
 * GET /api/v1/admin/contract
 *
 * Fetch current contract state
 */
export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  // Auth check
  if (!(await isAuthorized())) {
    await trackServerEvent({
      name: "admin_contract_unauthorized",
      properties: { endpoint: "contract" },
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let platform: AdminContractPlatform;
  try {
    platform = parseAdminContractPlatform(
      request.nextUrl.searchParams.get("platform"),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid admin contract platform",
      },
      { status: 400 },
    );
  }

  try {
    const { network } = resolveChainTarget(platform);
    const explorer = getExplorer(network);
    const chain = getPlatformChain(platform);
    const contractAddress = getWaffleContractAddress(platform);
    const publicClient = getPublicClient(platform);
    await trackServerEvent({
      name: "admin_contract_requested",
      properties: {
        platform,
        chain_id: chain.id,
      },
    });

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
    const isAdminWalletConfigured = !!env.defaultAdminPrivateKey;
    // let address = null;
    // let balance = null;

    const state: ContractState = {
      platform,
      network,
      address: contractAddress,
      chain: chain.name,
      chainId: chain.id,
      explorerName: explorer.name,
      explorerBaseUrl: explorer.baseUrl,
      token: {
        address: tokenAddress,
        symbol: getPaymentTokenSymbolForTarget({ platform, network }),
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
      adminWalletConfigured: isAdminWalletConfigured,
      treasuryWallet: getTreasuryWalletForPlatform(platform),
    };

    await trackServerEvent({
      name: "admin_contract_succeeded",
      properties: {
        platform,
        chain_id: chain.id,
        active_game_count: Number(activeGameCount),
        is_paused: isPaused,
        settlement_wallet_configured: isConfigured,
        admin_wallet_configured: isAdminWalletConfigured,
        duration_ms: Date.now() - startedAt,
      },
    });

    return NextResponse.json(state);
  } catch (error) {
    console.error("[Contract API] Error:", error);
    await trackServerEvent({
      name: "admin_contract_failed",
      properties: {
        duration_ms: Date.now() - startedAt,
        reason: error instanceof Error ? error.name : "unknown",
      },
    });
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
