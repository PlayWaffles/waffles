"use server";

import { formatUnits } from "viem";
import { requireAdminSession } from "@/lib/admin-auth";
import { logAdminAction, AdminAction, EntityType } from "@/lib/audit";
import { waffleGameAbi } from "@/lib/chain/abi";
import {
  getDefaultAdminWalletClient,
  getPublicClient,
} from "@/lib/chain/client";
import {
  PAYMENT_TOKEN_DECIMALS,
  getWaffleContractAddress,
} from "@/lib/chain/config";
import type { ChainPlatform } from "@/lib/chain/platform";
import { getPaymentTokenSymbolForTarget } from "@/lib/chain/token-display";
import { getTreasuryWalletForPlatform } from "@/lib/env";

type AdminContractPlatform = Extract<ChainPlatform, "BASE_APP" | "MINIPAY">;

function parseAdminContractPlatform(value: FormDataEntryValue | null): AdminContractPlatform {
  if (value === "BASE_APP") return "BASE_APP";
  if (value === "MINIPAY") return "MINIPAY";
  throw new Error("Choose Base or Celo before withdrawing protocol fees.");
}

export type WithdrawProtocolFeesResult =
  | {
      success: true;
      message: string;
      txHash: string;
      amountFormatted: string;
      treasuryWallet: string;
    }
  | {
      success: false;
      error: string;
    };

export async function withdrawProtocolFeesAction(
  prevState: WithdrawProtocolFeesResult | null,
  formData: FormData,
): Promise<WithdrawProtocolFeesResult> {
  void prevState;

  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: auth.error || "Unauthorized" };
  }

  let platform: AdminContractPlatform;
  try {
    platform = parseAdminContractPlatform(formData.get("platform"));
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid contract target",
    };
  }

  const contractAddress = getWaffleContractAddress(platform);
  const treasuryWallet = getTreasuryWalletForPlatform(platform);
  const tokenSymbol = getPaymentTokenSymbolForTarget({ platform });

  if (
    !treasuryWallet ||
    treasuryWallet === "0x0000000000000000000000000000000000000000"
  ) {
    return {
      success: false,
      error:
        platform === "MINIPAY"
          ? "NEXT_PUBLIC_TREASURY_WALLET_MINIPAY is not configured"
          : "NEXT_PUBLIC_TREASURY_WALLET is not configured",
    };
  }

  try {
    const publicClient = getPublicClient(platform);
    const walletClient = getDefaultAdminWalletClient(platform);
    const adminAddress = walletClient.account.address;

    const [defaultAdminRole, accumulatedFees] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "DEFAULT_ADMIN_ROLE",
      }) as Promise<`0x${string}`>,
      publicClient.readContract({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "accumulatedFees",
      }) as Promise<bigint>,
    ]);

    if (accumulatedFees <= BigInt(0)) {
      return {
        success: false,
        error: "There are no accumulated protocol fees to withdraw",
      };
    }

    const hasAdminRole = (await publicClient.readContract({
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "hasRole",
      args: [defaultAdminRole, adminAddress],
    })) as boolean;

    if (!hasAdminRole) {
      return {
        success: false,
        error: `Configured admin wallet ${adminAddress} does not have DEFAULT_ADMIN_ROLE on this contract`,
      };
    }

    const { request } = await publicClient.simulateContract({
      account: adminAddress,
      address: contractAddress,
      abi: waffleGameAbi,
      functionName: "withdrawFees",
      args: [treasuryWallet, accumulatedFees],
    });

    const txHash = await walletClient.writeContract({
      ...request,
      account: walletClient.account,
    });
    const amountFormatted = formatUnits(accumulatedFees, PAYMENT_TOKEN_DECIMALS);

    await logAdminAction({
      adminId: auth.session.userId,
      action: AdminAction.WITHDRAW_PROTOCOL_FEES,
      entityType: EntityType.SYSTEM,
      entityId: contractAddress,
      details: {
        platform,
        contractAddress,
        treasuryWallet,
        amount: accumulatedFees.toString(),
        amountFormatted,
        txHash,
        signer: adminAddress,
      },
    });

    return {
      success: true,
      message: `Withdrew ${amountFormatted} ${tokenSymbol} to treasury`,
      txHash,
      amountFormatted,
      treasuryWallet,
    };
  } catch (error) {
    console.error("withdrawProtocolFeesAction failed", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to withdraw protocol fees",
    };
  }
}
