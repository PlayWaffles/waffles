"use server";

import { z } from "zod";
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
import { assertChainPlatform } from "@/lib/chain/platform";
import { env } from "@/lib/env";

const withdrawProtocolFeesSchema = z.object({
  platform: z.string().optional(),
});

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
  _prevState: WithdrawProtocolFeesResult | null,
  formData: FormData,
): Promise<WithdrawProtocolFeesResult> {
  const auth = await requireAdminSession();
  if (!auth.authenticated || !auth.session) {
    return { success: false, error: auth.error || "Unauthorized" };
  }

  const validation = withdrawProtocolFeesSchema.safeParse({
    platform: formData.get("platform")?.toString(),
  });

  if (!validation.success) {
    return { success: false, error: "Invalid withdrawal request" };
  }

  const platform = assertChainPlatform(validation.data.platform ?? "FARCASTER");
  const contractAddress = getWaffleContractAddress(platform);
  const treasuryWallet = env.nextPublicTreasuryWallet;

  if (
    !treasuryWallet ||
    treasuryWallet === "0x0000000000000000000000000000000000000000"
  ) {
    return {
      success: false,
      error: "NEXT_PUBLIC_TREASURY_WALLET is not configured",
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
      message: `Withdrew ${amountFormatted} USDC to treasury`,
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
