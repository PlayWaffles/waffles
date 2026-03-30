import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";
import {
  PAYMENT_TOKEN_DECIMALS,
  getPaymentTokenAddress,
  getWaffleContractAddress,
} from "@/lib/chain";
import type { ChainTarget } from "@/lib/chain/network";
import { withBuilderCodeDataSuffix } from "@/lib/chain/builderCode";
import { waffleGameAbi } from "@/lib/chain/abi";
import { ERC20_ABI } from "@/lib/constants";

/**
 * Hook to read game data from the contract
 */
export function useGetGame(
  onchainId: `0x${string}` | null,
  target: ChainTarget,
) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "getGame",
    args: onchainId ? [onchainId] : undefined,
    query: {
      enabled: !!onchainId,
    },
  });
}

/**
 * Hook to get the payment token address from the WaffleGame contract
 * This prevents mismatch between hardcoded config and actual contract token
 */
export function useContractToken(target: ChainTarget) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "paymentToken",
  });
}

/**
 * Hook to check if a user has a ticket for a game
 */
export function useHasTicket(
  onchainId: `0x${string}`,
  playerAddress: `0x${string}`,
  target: ChainTarget,
) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "hasTicket",
    args: [onchainId, playerAddress],
    query: {
      enabled: !!onchainId && !!playerAddress,
    },
  });
}

/**
 * Hook to check if a user has claimed their prize
 */
export function useHasClaimed(
  onchainId: `0x${string}`,
  playerAddress: `0x${string}`,
  target: ChainTarget,
) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "hasClaimed",
    args: [onchainId, playerAddress],
  });
}

/**
 * Hook to get the user's token balance
 * @param address - User's wallet address
 * @param tokenAddress - Token address (optional, defaults to USDC)
 */
export function useTokenBalance(
  address: `0x${string}` | undefined,
  tokenAddress: `0x${string}`,
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

/**
 * Hook to get the user's token allowance for WaffleGame
 * @param ownerAddress - User's wallet address
 * @param tokenAddress - Token address
 */
export function useTokenAllowance(
  ownerAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  target: ChainTarget,
) {
  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [ownerAddress, getWaffleContractAddress(target)],
  });
}

/**
 * Hook to approve tokens for WaffleGame contract
 */
export function useApproveToken(target: ChainTarget) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const tokenAddress = getPaymentTokenAddress(target);
  const contractAddress = getWaffleContractAddress(target);

  const approve = (amount: string) => {
    const amountInUnits = parseUnits(amount, PAYMENT_TOKEN_DECIMALS);
    writeContract(
      withBuilderCodeDataSuffix({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [contractAddress, amountInUnits],
      }),
    );
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Hook to buy a ticket for a game
 */
export function useBuyTicket(target: ChainTarget) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const contractAddress = getWaffleContractAddress(target);

  const buyTicket = (onchainId: `0x${string}`, amount: string) => {
    const amountInUnits = parseUnits(amount, PAYMENT_TOKEN_DECIMALS);
    writeContract(
      withBuilderCodeDataSuffix({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "buyTicket",
        args: [onchainId, amountInUnits],
      }),
    );
  };

  return { buyTicket, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Hook to claim a prize using a Merkle proof
 */
export function useClaimPrize(target: ChainTarget) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const contractAddress = getWaffleContractAddress(target);

  const claimPrize = (
    onchainId: `0x${string}`,
    amount: bigint,
    proof: `0x${string}`[],
  ) => {
    writeContract(
      withBuilderCodeDataSuffix({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "claimPrize",
        args: [onchainId, amount, proof],
      }),
    );
  };

  return { claimPrize, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Hook to sponsor a game's prize pool (v5 feature)
 */
export function useSponsorPrizePool(target: ChainTarget) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });
  const contractAddress = getWaffleContractAddress(target);

  const sponsorPrizePool = (onchainId: `0x${string}`, amount: string) => {
    const amountInUnits = parseUnits(amount, PAYMENT_TOKEN_DECIMALS);
    writeContract(
      withBuilderCodeDataSuffix({
        address: contractAddress,
        abi: waffleGameAbi,
        functionName: "sponsorPrizePool",
        args: [onchainId, amountInUnits],
      }),
    );
  };

  return { sponsorPrizePool, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Hook to get the total prize pool for a game (v5 feature)
 * Includes ticket revenue (net of fees) + sponsored amounts
 */
export function useGetTotalPrizePool(
  onchainId: `0x${string}`,
  target: ChainTarget,
) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "getTotalPrizePool",
    args: [onchainId],
    query: {
      enabled: !!onchainId,
    },
  });
}

/**
 * Hook to get accumulated platform fees (admin use)
 */
export function useAccumulatedFees(target: ChainTarget) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "accumulatedFees",
  });
}

/**
 * Hook to get the platform fee percentage
 */
export function usePlatformFee(target: ChainTarget) {
  return useReadContract({
    address: getWaffleContractAddress(target),
    abi: waffleGameAbi,
    functionName: "platformFeePermyriad",
  });
}
