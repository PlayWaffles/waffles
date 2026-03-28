"use client";

import { useState } from "react";
import {
    SparklesIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    BanknotesIcon,
} from "@heroicons/react/24/outline";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import {
    useSponsorPrizePool,
    useGetTotalPrizePool,
    useTokenBalance,
    useApproveToken,
    useTokenAllowance
} from "@/hooks/waffleContractHooks";
import { PAYMENT_TOKEN_DECIMALS, getPaymentTokenAddress } from "@/lib/chain";
import { parseUnits, formatUnits } from "viem";
import type { ChainPlatform } from "@/lib/chain/platform";

interface SponsorGameCardProps {
    gameId: string;
    onchainId: `0x${string}`;
    gameTitle: string;
    platform: ChainPlatform;
}

export function SponsorGameCard({ gameId, onchainId, gameTitle, platform }: SponsorGameCardProps) {
    const [amount, setAmount] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);
    const tokenAddress = getPaymentTokenAddress(platform);

    // Wallet connection
    const { address, isConnected } = useAccount();
    const { connect } = useConnect();

    // Contract hooks
    const { sponsorPrizePool, hash, isPending: isSponsorPending, isConfirming, isSuccess, error } = useSponsorPrizePool(platform);
    const { data: totalPrizePool, refetch: refetchPrizePool } = useGetTotalPrizePool(onchainId, platform);
    const { data: balance } = useTokenBalance(address, tokenAddress);
    const { approve, isPending: isApprovePending, isSuccess: approveSuccess } = useApproveToken(platform);
    const { data: allowance, refetch: refetchAllowance } = useTokenAllowance(
        address || "0x0000000000000000000000000000000000000000" as `0x${string}`,
        tokenAddress,
        platform,
    );

    const isPending = isSponsorPending || isApprovePending || isConfirming;

    // Calculate if approval is needed
    const amountInUnits = amount ? parseUnits(amount, PAYMENT_TOKEN_DECIMALS) : BigInt(0);
    const allowanceBigInt = typeof allowance === "bigint" ? allowance : BigInt(0);
    const needsApproval = amountInUnits > BigInt(0) && amountInUnits > allowanceBigInt;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isConnected) {
            console.log("[Sponsor] Not connected, connecting...");
            connect({ connector: injected() });
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            console.log("[Sponsor] Invalid amount:", amount);
            return;
        }

        if (needsApproval) {
            console.log("[Sponsor] Approving", amount, "USDC");
            approve(amount);
            return;
        }

        console.log("[Sponsor] Sponsoring", amount, "USDC to game", onchainId);
        sponsorPrizePool(onchainId, amount);
    };

    // After success, refetch
    if (isSuccess || approveSuccess) {
        refetchPrizePool();
        refetchAllowance();
    }

    const formattedBalance = balance
        ? parseFloat(formatUnits(balance as bigint, PAYMENT_TOKEN_DECIMALS)).toFixed(2)
        : "0.00";

    const formattedPrizePool = totalPrizePool
        ? parseFloat(formatUnits(totalPrizePool as bigint, PAYMENT_TOKEN_DECIMALS)).toFixed(2)
        : "0.00";

    return (
        <div className="bg-linear-to-br from-[#14B985]/10 to-[#14B985]/5 border border-[#14B985]/20 rounded-2xl overflow-hidden">
            {/* Header - Always visible */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-[#14B985]/20">
                        <SparklesIcon className="h-6 w-6 text-[#14B985]" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-white font-display">Sponsor Prize Pool</h3>
                        <p className="text-sm text-white/50">
                            Add funds to increase the prize pool
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-white/40">Current Pool</p>
                        <p className="text-lg font-bold text-[#14B985]">${formattedPrizePool}</p>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/10 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <svg className="h-5 w-5 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </button>

            {/* Expandable Form */}
            {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-white/10">
                    {/* Success Message */}
                    {isSuccess && (
                        <div className="mb-4 p-3 bg-[#14B985]/20 border border-[#14B985]/30 rounded-xl flex items-center gap-3">
                            <CheckCircleIcon className="h-5 w-5 text-[#14B985] shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-[#14B985]">Sponsorship Successful!</p>
                                <p className="text-xs text-white/50">Prize pool has been increased</p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-400 shrink-0" />
                            <p className="text-sm text-red-400">{error.message}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Amount Input */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Sponsorship Amount
                            </label>
                            <div className="relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    <BanknotesIcon className="h-5 w-5 text-[#14B985]" />
                                    <span className="text-[#14B985] font-medium">$</span>
                                </div>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full pl-16 pr-20 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-medium placeholder-white/30 focus:ring-2 focus:ring-[#14B985]/50 focus:border-[#14B985] transition-all"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <span className="text-white/40 text-sm">USDC</span>
                                </div>
                            </div>

                            {/* Balance Info */}
                            {isConnected && (
                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <span className="text-white/40">
                                        Balance: <span className="text-white/60">${formattedBalance} USDC</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setAmount(formattedBalance)}
                                        className="text-[#14B985] hover:text-[#14B985]/80 font-medium"
                                    >
                                        Max
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isPending || (!amount && isConnected)}
                            className="w-full py-4 bg-[#14B985] hover:bg-[#14B985]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#14B985]/20"
                        >
                            {isPending ? (
                                <>
                                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                    {isConfirming ? "Confirming..." : needsApproval ? "Approving..." : "Sponsoring..."}
                                </>
                            ) : !isConnected ? (
                                "Connect Wallet"
                            ) : needsApproval ? (
                                <>
                                    <CheckCircleIcon className="h-5 w-5" />
                                    Approve USDC
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="h-5 w-5" />
                                    Sponsor Prize Pool
                                </>
                            )}
                        </button>

                        {/* Transaction Hash */}
                        {hash && (
                            <div className="text-center">
                                <a
                                    href={`https://basescan.org/tx/${hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                                >
                                    View Transaction ↗
                                </a>
                            </div>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}
