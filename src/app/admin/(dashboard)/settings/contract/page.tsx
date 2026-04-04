"use client";

import { useState, useEffect } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
    CurrencyDollarIcon,
    ChartPieIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ArrowTopRightOnSquareIcon,
    ArrowPathIcon,
    BanknotesIcon,
    ShieldExclamationIcon,
    LinkIcon,
    ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import {
    withdrawProtocolFeesAction,
    type WithdrawProtocolFeesResult,
} from "@/actions/admin/contract";

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
    adminWalletConfigured: boolean;
    treasuryWallet: string;
}

export default function ContractSettingsPage() {
    const [state, setState] = useState<ContractState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [withdrawState, withdrawAction, withdrawPending] = useActionState<
        WithdrawProtocolFeesResult | null,
        FormData
    >(withdrawProtocolFeesAction, null);

    const fetchContractState = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/admin/contract", {
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error("Failed to fetch contract state");
            }
            const data = await res.json();
            setState(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContractState();
    }, []);

    useEffect(() => {
        if (withdrawState?.success) {
            void fetchContractState();
        }
    }, [withdrawState]);

    const truncateAddress = (addr: string) =>
        `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    if (loading && !state) {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="rounded-2xl border border-white/10 p-8 text-center">
                    <ArrowPathIcon className="h-8 w-8 text-[#FFC931] animate-spin mx-auto mb-3" />
                    <p className="text-white/60">Loading contract state...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="rounded-2xl border border-red-500/30 p-8 text-center bg-red-500/5">
                    <ExclamationTriangleIcon className="h-8 w-8 text-red-400 mx-auto mb-3" />
                    <p className="text-red-400 font-medium">{error}</p>
                    <button
                        onClick={fetchContractState}
                        className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!state) return null;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white font-display">
                        Contract Management
                    </h1>
                    <p className="text-white/50 text-sm mt-1">
                        WaffleGame smart contract on {state.chain}
                    </p>
                </div>
                <button
                    onClick={fetchContractState}
                    disabled={loading}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                >
                    <ArrowPathIcon className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Status Banner */}
            {state.isPaused && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                    <ShieldExclamationIcon className="h-6 w-6 text-red-400 shrink-0" />
                    <div>
                        <p className="text-red-400 font-medium">Contract is Paused</p>
                        <p className="text-red-400/70 text-sm">All operations are currently halted.</p>
                    </div>
                </div>
            )}

            {!state.settlementWalletConfigured && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center gap-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-orange-400 shrink-0" />
                    <div>
                        <p className="text-orange-400 font-medium">Settlement Wallet Not Configured</p>
                        <p className="text-orange-400/70 text-sm">
                            Set <code className="bg-black/30 px-1 rounded">SETTLEMENT_PRIVATE_KEY</code> in your environment variables.
                        </p>
                    </div>
                </div>
            )}

            {!state.adminWalletConfigured && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-center gap-3">
                    <ExclamationTriangleIcon className="h-6 w-6 text-orange-400 shrink-0" />
                    <div>
                        <p className="text-orange-400 font-medium">Default Admin Wallet Not Configured</p>
                        <p className="text-orange-400/70 text-sm">
                            Set <code className="bg-black/30 px-1 rounded">DEFAULT_ADMIN_PRIVATE_KEY</code> or <code className="bg-black/30 px-1 rounded">SUPER_ADMIN_PRIVATE_KEY</code> to enable fee withdrawals.
                        </p>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Accumulated Fees */}
                <div className="rounded-2xl border border-white/10 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#14B985]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#14B985]/20 transition-colors" />
                    <div className="relative">
                        <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                            <BanknotesIcon className="h-4 w-4" />
                            <span>Accumulated Fees</span>
                        </div>
                        <div className="text-3xl font-bold text-[#14B985]">
                            ${Number(state.accumulatedFeesFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-white/40 text-xs mt-1">{state.token.symbol}</div>
                    </div>
                </div>

                {/* Active Games */}
                <div className="rounded-2xl border border-white/10 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#00CFF2]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#00CFF2]/20 transition-colors" />
                    <div className="relative">
                        <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                            <ChartPieIcon className="h-4 w-4" />
                            <span>Active Games</span>
                        </div>
                        <div className="text-3xl font-bold text-[#00CFF2]">
                            {state.activeGameCount}
                        </div>
                        <div className="text-white/40 text-xs mt-1">Currently accepting tickets</div>
                    </div>
                </div>

                {/* Platform Fee */}
                <div className="rounded-2xl border border-white/10 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFC931]/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#FFC931]/20 transition-colors" />
                    <div className="relative">
                        <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                            <CurrencyDollarIcon className="h-4 w-4" />
                            <span>Platform Fee</span>
                        </div>
                        <div className="text-3xl font-bold text-[#FFC931]">
                            {state.platformFeePercent}%
                        </div>
                        <div className="text-white/40 text-xs mt-1">{state.platformFeeBps} basis points</div>
                    </div>
                </div>
            </div>

            {/* Contract Details */}
            <div className="rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-2 mb-5">
                    <LinkIcon className="h-5 w-5 text-[#FFC931]" />
                    <h2 className="text-lg font-semibold text-white font-display">Contract Details</h2>
                </div>

                <div className="space-y-4">
                    {/* Contract Address */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <div>
                            <p className="text-white/50 text-sm mb-1">Contract Address</p>
                            <p className="text-white font-mono">{state.address}</p>
                        </div>
                        <a
                            href={`https://basescan.org/address/${state.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                        >
                            <span>View on Basescan</span>
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                    </div>

                    {/* Token Address */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <div>
                            <p className="text-white/50 text-sm mb-1">Payment Token</p>
                            <div className="flex items-center gap-3">
                                <span className="text-white font-mono">{truncateAddress(state.token.address)}</span>
                                <span className="px-2 py-0.5 bg-[#00CFF2]/20 text-[#00CFF2] text-xs font-medium rounded">
                                    {state.token.symbol}
                                </span>
                            </div>
                        </div>
                        <a
                            href={`https://basescan.org/address/${state.token.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                        >
                            <span>View Token</span>
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                    </div>

                    {/* Treasury Wallet */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <div>
                            <p className="text-white/50 text-sm mb-1">Treasury Wallet</p>
                            <p className="text-white font-mono">{state.treasuryWallet}</p>
                        </div>
                    </div>

                    {/* Chain */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <div>
                            <p className="text-white/50 text-sm mb-1">Network</p>
                            <div className="flex items-center gap-3">
                                <span className="text-white">{state.chain}</span>
                                <span className="px-2 py-0.5 bg-[#14B985]/20 text-[#14B985] text-xs font-medium rounded">
                                    Chain ID: {state.chainId}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[#14B985]">
                            <CheckCircleIcon className="h-5 w-5" />
                            <span className="text-sm font-medium">Connected</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 p-6">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <h2 className="text-lg font-semibold text-white font-display">
                            Withdraw Protocol Fees
                        </h2>
                        <p className="mt-2 text-sm text-white/50 max-w-2xl">
                            Withdraw the full on-chain <code className="bg-black/30 px-1 rounded">accumulatedFees</code> balance to the configured treasury wallet.
                        </p>
                    </div>
                    <form action={withdrawAction} className="shrink-0">
                        <input type="hidden" name="platform" value="FARCASTER" />
                        <button
                            type="submit"
                            disabled={
                                withdrawPending ||
                                !state.adminWalletConfigured ||
                                Number(state.accumulatedFeesFormatted) <= 0
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-[#14B985] px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#2cd39d] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            {withdrawPending ? "Withdrawing..." : "Withdraw to Treasury"}
                        </button>
                    </form>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-white/60">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        Destination: <span className="font-mono text-white">{state.treasuryWallet}</span>
                    </div>
                    {withdrawState ? (
                        <div
                            className={`rounded-xl border p-4 ${
                                withdrawState.success
                                    ? "border-[#14B985]/30 bg-[#14B985]/10 text-[#14B985]"
                                    : "border-red-500/30 bg-red-500/10 text-red-400"
                            }`}
                        >
                            {withdrawState.success ? (
                                <div className="space-y-1">
                                    <p>{withdrawState.message}</p>
                                    <p className="text-xs break-all">
                                        Tx: {withdrawState.txHash}
                                    </p>
                                </div>
                            ) : (
                                <p>{withdrawState.error}</p>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Admin Actions Info */}
            <div className="rounded-2xl border border-orange-500/30 p-6 bg-orange-500/5">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-500/20 rounded-xl">
                        <Cog6ToothIcon className="h-6 w-6 text-orange-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white font-display mb-2">
                            Admin Functions
                        </h3>
                        <p className="text-white/60 text-sm mb-4">
                            Role-based access control governs all privileged operations:
                        </p>

                        {/* Super Admin Functions */}
                        <div className="mb-4">
                            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">DEFAULT_ADMIN_ROLE (Cold Wallet)</p>
                            <ul className="space-y-2 text-sm text-white/50">
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-400 rounded-full" />
                                    <strong className="text-white">setPaymentToken</strong> - Change payment token (requires no active games)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-400 rounded-full" />
                                    <strong className="text-white">setPlatformFee</strong> - Update fee percentage
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-400 rounded-full" />
                                    <strong className="text-white">withdrawFees</strong> - Withdraw accumulated fees
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-orange-400 rounded-full" />
                                    <strong className="text-white">sweepUnclaimedFunds</strong> - Recover unclaimed funds after 90 days
                                </li>
                            </ul>
                        </div>

                        {/* Operator Functions */}
                        <div className="mb-4">
                            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">OPERATOR_ROLE (Hot Wallet)</p>
                            <ul className="space-y-2 text-sm text-white/50">
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#00CFF2] rounded-full" />
                                    <strong className="text-white">createGame</strong> - Create new game on-chain
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#00CFF2] rounded-full" />
                                    <strong className="text-white">closeSales</strong> - Stop ticket purchases
                                </li>
                            </ul>
                        </div>

                        {/* Settler Functions */}
                        <div className="mb-4">
                            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">SETTLER_ROLE</p>
                            <ul className="space-y-2 text-sm text-white/50">
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#14B985] rounded-full" />
                                    <strong className="text-white">submitResults</strong> - Publish Merkle root of winners
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#14B985] rounded-full" />
                                    <strong className="text-white">correctResultsRoot</strong> - Fix Merkle root (before any claims)
                                </li>
                            </ul>
                        </div>

                        {/* Public Functions */}
                        <div className="mb-4">
                            <p className="text-xs text-white/40 uppercase tracking-wide mb-2">PUBLIC (Anyone)</p>
                            <ul className="space-y-2 text-sm text-white/50">
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#FFC931] rounded-full" />
                                    <strong className="text-white">sponsorPrizePool</strong> - Sponsor a game&apos;s prize pool (fee deducted)
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#FFC931] rounded-full" />
                                    <strong className="text-white">buyTicket</strong> - Purchase game ticket
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-[#FFC931] rounded-full" />
                                    <strong className="text-white">claimPrize</strong> - Claim winnings with Merkle proof
                                </li>
                            </ul>
                        </div>

                        <p className="text-white/40 text-xs">
                            Admin functions should be executed directly on Basescan or via your multisig wallet.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
