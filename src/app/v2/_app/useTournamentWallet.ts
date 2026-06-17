"use client";

/**
 * Client wallet wiring for on-chain tournaments. Promise-based wrappers around
 * the exact same contract config the v1 player used (`waffleGameAbi`, the
 * payment token, the builder-code data suffix) — so entry (`buyTicket`) and
 * prize `claimPrize` reuse v1's chain layer verbatim, just exposed as awaitable
 * functions the ProtoProvider's async actions can call.
 *
 * Platform is passed per-call (taken from the server-loaded game) rather than at
 * hook time, since the provider doesn't know it until the tournament loads.
 */
import { useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { waffleGameAbi } from "@/lib/chain/abi";
import { withBuilderCodeDataSuffix } from "@/lib/chain/builderCode";
import {
  PAYMENT_TOKEN_DECIMALS,
  getPaymentTokenAddress,
  getPlatformChain,
  getWaffleContractAddress,
} from "@/lib/chain/config";
import { defaultNetworkForPlatform } from "@/lib/chain/network";
import type { ChainPlatform } from "@/lib/chain/platform";
import { ERC20_ABI } from "@/lib/constants";

export function useTournamentWallet() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  /**
   * Approve (if needed) + `buyTicket`. Resolves with the entry tx hash once it's
   * confirmed, ready to hand to `v2EnterTournament` for on-chain verification.
   */
  const enter = useCallback(
    async (
      platform: ChainPlatform,
      onchainId: `0x${string}`,
      entryFeeUsdc: number,
    ): Promise<`0x${string}`> => {
      if (!address) throw new Error("wallet_not_connected");
      if (!publicClient) throw new Error("no_public_client");
      const target = { platform, network: defaultNetworkForPlatform(platform) };
      const chainId = getPlatformChain(target).id;
      const contractAddress = getWaffleContractAddress(target);
      const tokenAddress = getPaymentTokenAddress(target);
      const amount = parseUnits(entryFeeUsdc.toString(), PAYMENT_TOKEN_DECIMALS);

      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, contractAddress],
      })) as bigint;

      if (allowance < amount) {
        const approveHash = await writeContractAsync(
          withBuilderCodeDataSuffix({
            chainId,
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [contractAddress, amount],
          }),
        );
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const buyHash = await writeContractAsync(
        withBuilderCodeDataSuffix({
          chainId,
          address: contractAddress,
          abi: waffleGameAbi,
          functionName: "buyTicket",
          args: [onchainId, amount],
        }),
      );
      await publicClient.waitForTransactionReceipt({ hash: buyHash });
      return buyHash;
    },
    [address, publicClient, writeContractAsync],
  );

  /**
   * Claim a settled prize from the on-chain pool with the merkle proof produced
   * by `publishResults`. Resolves with the claim tx hash once confirmed.
   */
  const claim = useCallback(
    async (
      platform: ChainPlatform,
      onchainId: `0x${string}`,
      amount: bigint,
      proof: `0x${string}`[],
    ): Promise<`0x${string}`> => {
      if (!publicClient) throw new Error("no_public_client");
      const target = { platform, network: defaultNetworkForPlatform(platform) };
      const chainId = getPlatformChain(target).id;
      const contractAddress = getWaffleContractAddress(target);
      const hash = await writeContractAsync(
        withBuilderCodeDataSuffix({
          chainId,
          address: contractAddress,
          abi: waffleGameAbi,
          functionName: "claimPrize",
          args: [onchainId, amount, proof],
        }),
      );
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    },
    [publicClient, writeContractAsync],
  );

  return { address, enter, claim };
}
