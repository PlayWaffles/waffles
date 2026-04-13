"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SparklesIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    BanknotesIcon,
} from "@heroicons/react/24/outline";
import {
    useAccount,
    useChainId,
    useConnect,
    useSwitchChain,
    useWriteContract,
} from "wagmi";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { BaseError, formatUnits, parseUnits } from "viem";

import {
    useGetTotalPrizePool,
    useTokenBalance,
    useTokenAllowance,
    useContractToken,
    usePlatformFee,
} from "@/hooks/waffleContractHooks";
import {
    PAYMENT_TOKEN_DECIMALS,
    getPaymentTokenAddress,
    getPlatformChain,
    getWaffleContractAddress,
} from "@/lib/chain";
import { ERC20_ABI } from "@/lib/constants";
import { wagmiConfig } from "@/lib/wagmi/config";
import { waffleGameAbi } from "@/lib/chain/abi";
import { withBuilderCodeDataSuffix } from "@/lib/chain/builderCode";
import type { ChainPlatform } from "@/lib/chain/platform";
import type { GameNetwork } from "@/lib/chain/network";

interface SponsorGameCardProps {
    gameId: string;
    onchainId: `0x${string}`;
    gameTitle: string;
    platform: ChainPlatform;
    network: GameNetwork;
}

type SponsorStep =
    | "idle"
    | "connecting"
    | "switching"
    | "approving"
    | "confirming-approval"
    | "sponsoring"
    | "confirming-sponsorship"
    | "success"
    | "error";

function getExplorerTxUrl(network: GameNetwork, hash: `0x${string}`) {
  if (network === "BASE_MAINNET") return `https://basescan.org/tx/${hash}`;
  if (network === "BASE_SEPOLIA") return `https://sepolia.basescan.org/tx/${hash}`;
  if (network === "CELO_MAINNET") return `https://celoscan.io/tx/${hash}`;
  return `https://celo-sepolia.blockscout.com/tx/${hash}`;
}

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function getContractErrorMessage(error: unknown) {
    if (!error) return null;

    const normalizedError = toError(error);

    if (normalizedError instanceof BaseError) {
        const revertError = normalizedError.walk((candidate) => {
            if (!candidate || typeof candidate !== "object") {
                return false;
            }

            const shortMessage = "shortMessage" in candidate && typeof candidate.shortMessage === "string"
                ? candidate.shortMessage
                : "";

            if (!shortMessage) {
                return false;
            }

            return shortMessage.toLowerCase().includes("reverted");
        });

        if (
            revertError &&
            typeof revertError === "object" &&
            "shortMessage" in revertError &&
            typeof revertError.shortMessage === "string"
        ) {
            return revertError.shortMessage;
        }

        if (normalizedError.shortMessage) {
            return normalizedError.shortMessage;
        }
    }

    return normalizedError.message;
}

async function getLiveWalletChainId() {
    if (typeof window === "undefined") return null;

    const ethereum = (window as Window & {
        ethereum?: { request?: (args: { method: string }) => Promise<string> };
    }).ethereum;

    if (!ethereum?.request) return null;

    try {
        const hexChainId = await ethereum.request({ method: "eth_chainId" });
        return Number.parseInt(hexChainId, 16);
    } catch {
        return null;
    }
}

async function requestLiveWalletChainSwitch(targetChainId: number) {
    if (typeof window === "undefined") {
        throw new Error("No injected wallet provider found.");
    }

    const ethereum = (window as Window & {
        ethereum?: {
            request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        };
    }).ethereum;

    if (!ethereum?.request) {
        throw new Error("No injected wallet provider found.");
    }

    await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
    });
}

function formatUsdAmount(amount: string) {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) return amount;
    return parsed.toFixed(2);
}

export function SponsorGameCard({ gameId, onchainId, gameTitle, platform, network }: SponsorGameCardProps) {
    const router = useRouter();
    const [amount, setAmount] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);
    const [step, setStep] = useState<SponsorStep>("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
    const [liveWalletChainId, setLiveWalletChainId] = useState<number | null>(null);

    const target = useMemo(() => ({ platform, network } as const), [network, platform]);
    const targetChain = getPlatformChain(target);
    const contractAddress = getWaffleContractAddress(target);
    const configuredTokenAddress = getPaymentTokenAddress(target);
    const wagmiChainId = useChainId();

    const { address, isConnected } = useAccount();
    const { connectAsync, connectors, isPending: isConnecting } = useConnect();
    const { switchChainAsync } = useSwitchChain();
    const { writeContractAsync } = useWriteContract();

    const preferredConnector = useMemo(
        () => connectors.find((connector) => connector.id === "injected") || connectors[0],
        [connectors],
    );

    const { data: contractTokenAddress } = useContractToken(target);
    const tokenAddress = (contractTokenAddress as `0x${string}` | undefined) ?? configuredTokenAddress;

    const {
        data: totalPrizePool,
        refetch: refetchPrizePool,
    } = useGetTotalPrizePool(onchainId, target);
    const { data: platformFeePermyriad } = usePlatformFee(target);
    const {
        data: balance,
        refetch: refetchBalance,
    } = useTokenBalance(address, tokenAddress, target);
    const {
        data: allowance,
        refetch: refetchAllowance,
    } = useTokenAllowance(
        (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        tokenAddress,
        target,
    );

    const amountInUnits = amount ? parseUnits(amount, PAYMENT_TOKEN_DECIMALS) : BigInt(0);
    const maxAmount = balance ? formatUnits(balance as bigint, PAYMENT_TOKEN_DECIMALS) : "0";
    const formattedBalance = balance
        ? parseFloat(formatUnits(balance as bigint, PAYMENT_TOKEN_DECIMALS)).toFixed(2)
        : "0.00";
    const formattedPrizePool = totalPrizePool
        ? parseFloat(formatUnits(totalPrizePool as bigint, PAYMENT_TOKEN_DECIMALS)).toFixed(2)
        : "0.00";
    const allowanceBigInt = typeof allowance === "bigint" ? allowance : BigInt(0);
    const feePermyriadBigInt = typeof platformFeePermyriad === "bigint"
        ? platformFeePermyriad
        : BigInt(2000);
    const sponsorshipFeeUnits = amountInUnits > BigInt(0)
        ? (amountInUnits * feePermyriadBigInt) / BigInt(10000)
        : BigInt(0);
    const sponsorshipNetUnits = amountInUnits > sponsorshipFeeUnits
        ? amountInUnits - sponsorshipFeeUnits
        : BigInt(0);
    const projectedPrizePoolUnits = typeof totalPrizePool === "bigint"
        ? totalPrizePool + sponsorshipNetUnits
        : sponsorshipNetUnits;
    const feePercent = Number(feePermyriadBigInt) / 100;
    const formattedGrossAmount = amountInUnits > BigInt(0)
        ? formatUsdAmount(formatUnits(amountInUnits, PAYMENT_TOKEN_DECIMALS))
        : "0.00";
    const formattedSponsorshipFee = formatUsdAmount(
        formatUnits(sponsorshipFeeUnits, PAYMENT_TOKEN_DECIMALS),
    );
    const formattedNetSponsorship = formatUsdAmount(
        formatUnits(sponsorshipNetUnits, PAYMENT_TOKEN_DECIMALS),
    );
    const formattedProjectedPrizePool = formatUsdAmount(
        formatUnits(projectedPrizePoolUnits, PAYMENT_TOKEN_DECIMALS),
    );
    const effectiveChainId = liveWalletChainId ?? wagmiChainId;
    const isOnCorrectChain = isConnected && effectiveChainId === targetChain.id;
    const needsApproval = amountInUnits > BigInt(0) && allowanceBigInt < amountInUnits;
    const isWorking = step !== "idle" && step !== "success" && step !== "error";

    const refreshLiveChainId = useCallback(async () => {
        const nextChainId = await getLiveWalletChainId();
        setLiveWalletChainId(nextChainId);
        return nextChainId;
    }, []);

    useEffect(() => {
        if (!isConnected) {
            setLiveWalletChainId(null);
            return;
        }

        void refreshLiveChainId();
    }, [isConnected, refreshLiveChainId, wagmiChainId]);

    useEffect(() => {
        console.log("[Sponsor]", {
            stage: "state",
            gameId,
            gameTitle,
            onchainId,
            address: address ?? null,
            isConnected,
            amount,
            amountInUnits: amountInUnits.toString(),
            tokenAddress,
            configuredTokenAddress,
            contractTokenAddress: contractTokenAddress ?? null,
            balance: typeof balance === "bigint" ? balance.toString() : null,
            allowance: typeof allowance === "bigint" ? allowance.toString() : null,
            needsApproval,
            wagmiChainId,
            liveWalletChainId,
            effectiveChainId,
            targetChainId: targetChain.id,
            step,
            txHash,
            errorMessage,
        });
    }, [
        address,
        allowance,
        amount,
        amountInUnits,
        balance,
        configuredTokenAddress,
        contractTokenAddress,
        effectiveChainId,
        errorMessage,
        gameId,
        gameTitle,
        isConnected,
        liveWalletChainId,
        needsApproval,
        onchainId,
        step,
        targetChain.id,
        tokenAddress,
        txHash,
        wagmiChainId,
    ]);

    const readBalanceOnTargetChain = useCallback(
        async (ownerAddress: `0x${string}`) => {
            const result = await readContract(wagmiConfig, {
                chainId: targetChain.id,
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "balanceOf",
                args: [ownerAddress],
            });

            return result as bigint;
        },
        [targetChain.id, tokenAddress],
    );

    const readAllowanceOnTargetChain = useCallback(
        async (ownerAddress: `0x${string}`) => {
            const result = await readContract(wagmiConfig, {
                chainId: targetChain.id,
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [ownerAddress, contractAddress],
            });

            return result as bigint;
        },
        [contractAddress, targetChain.id, tokenAddress],
    );

    const ensureTargetChain = useCallback(async () => {
        const initialLiveChainId = await refreshLiveChainId();

        if (initialLiveChainId === targetChain.id) {
            return initialLiveChainId;
        }

        setStep("switching");
        console.log("[Sponsor]", {
            stage: "chain-switch-start",
            liveWalletChainId: initialLiveChainId,
            wagmiChainId,
            targetChainId: targetChain.id,
        });

        try {
            await switchChainAsync({ chainId: targetChain.id });
        } catch (wagmiError) {
            console.log("[Sponsor]", {
                stage: "chain-switch-wagmi-error",
                message: getContractErrorMessage(wagmiError),
            });

            await requestLiveWalletChainSwitch(targetChain.id);
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
        const confirmedLiveChainId = await refreshLiveChainId();

        console.log("[Sponsor]", {
            stage: "chain-switch-finished",
            confirmedLiveChainId,
            targetChainId: targetChain.id,
        });

        if (confirmedLiveChainId !== targetChain.id) {
            throw new Error(
                `Your wallet is still on chain ${confirmedLiveChainId ?? "unknown"}. Please switch it to ${targetChain.name} (chain ${targetChain.id}) and try again.`,
            );
        }

        return confirmedLiveChainId;
    }, [refreshLiveChainId, switchChainAsync, targetChain.id, targetChain.name, wagmiChainId]);

    const handleSwitchNetwork = async () => {
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            await ensureTargetChain();
            setStep("idle");
        } catch (error) {
            setStep("error");
            setErrorMessage(
                getContractErrorMessage(error) ??
                `Please switch your wallet to ${targetChain.name} (chain ${targetChain.id}).`,
            );
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        console.log("[Sponsor]", {
            stage: "submit",
            gameId,
            onchainId,
            amount,
            isConnected,
            effectiveChainId,
            targetChainId: targetChain.id,
        });

        if (!amount || Number(amount) <= 0) {
            setStep("error");
            setErrorMessage("Enter a sponsorship amount greater than 0.");
            return;
        }

        try {
            let sponsorAddress = address;

            if (!sponsorAddress || !isConnected) {
                if (!preferredConnector) {
                    throw new Error("No wallet connector is available.");
                }

                setStep("connecting");
                console.log("[Sponsor]", {
                    stage: "connect-start",
                    connectorId: preferredConnector.id,
                    connectorName: preferredConnector.name,
                });

                const connection = await connectAsync({ connector: preferredConnector });
                sponsorAddress = connection.accounts[0] as `0x${string}` | undefined;

                console.log("[Sponsor]", {
                    stage: "connect-success",
                    connectorId: preferredConnector.id,
                    connectorName: preferredConnector.name,
                    account: sponsorAddress ?? null,
                    chainId: connection.chainId,
                });
            }

            if (!sponsorAddress) {
                throw new Error("Wallet connected, but no account was returned.");
            }

            await ensureTargetChain();

            const [latestBalance, latestAllowance] = await Promise.all([
                readBalanceOnTargetChain(sponsorAddress),
                readAllowanceOnTargetChain(sponsorAddress),
            ]);

            console.log("[Sponsor]", {
                stage: "preflight",
                sponsorAddress,
                latestBalance: latestBalance.toString(),
                latestAllowance: latestAllowance.toString(),
                amountInUnits: amountInUnits.toString(),
            });

            if (latestBalance < amountInUnits) {
                throw new Error("Insufficient USDC balance for this sponsorship.");
            }

            if (latestAllowance < amountInUnits) {
                setStep("approving");
                console.log("[Sponsor]", {
                    stage: "approval-submit",
                    sponsorAddress,
                    amountInUnits: amountInUnits.toString(),
                    tokenAddress,
                    contractAddress,
                    chainId: targetChain.id,
                });

                const approvalHash = await writeContractAsync(
                    withBuilderCodeDataSuffix({
                        chainId: targetChain.id,
                        address: tokenAddress,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [contractAddress, amountInUnits],
                    }),
                );

                setTxHash(approvalHash);
                setStep("confirming-approval");
                console.log("[Sponsor]", {
                    stage: "approval-submitted",
                    approvalHash,
                });

                await waitForTransactionReceipt(wagmiConfig, {
                    hash: approvalHash,
                    chainId: targetChain.id,
                    confirmations: 1,
                });

                console.log("[Sponsor]", {
                    stage: "approval-confirmed",
                    approvalHash,
                });

                const updatedAllowance = await readAllowanceOnTargetChain(sponsorAddress);

                console.log("[Sponsor]", {
                    stage: "approval-postcheck",
                    updatedAllowance: updatedAllowance.toString(),
                    requiredAllowance: amountInUnits.toString(),
                });

                if (updatedAllowance < amountInUnits) {
                    throw new Error(
                        `Approval confirmed, but allowance is still too low on ${targetChain.name}.`,
                    );
                }
            }

            setStep("sponsoring");
            console.log("[Sponsor]", {
                stage: "sponsor-submit",
                sponsorAddress,
                onchainId,
                amountInUnits: amountInUnits.toString(),
                contractAddress,
                chainId: targetChain.id,
            });

            const sponsorshipHash = await writeContractAsync(
                withBuilderCodeDataSuffix({
                    chainId: targetChain.id,
                    address: contractAddress,
                    abi: waffleGameAbi,
                    functionName: "sponsorPrizePool",
                    args: [onchainId, amountInUnits],
                }),
            );

            setTxHash(sponsorshipHash);
            setStep("confirming-sponsorship");
            console.log("[Sponsor]", {
                stage: "sponsor-submitted",
                sponsorshipHash,
            });

            await waitForTransactionReceipt(wagmiConfig, {
                hash: sponsorshipHash,
                chainId: targetChain.id,
                confirmations: 1,
            });

            console.log("[Sponsor]", {
                stage: "sponsor-confirmed",
                sponsorshipHash,
            });

            const syncResponse = await fetch(`/api/v1/admin/games/${gameId}/sponsorship/sync`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ txHash: sponsorshipHash }),
            });

            const syncResult = (await syncResponse.json().catch(() => null)) as
                | { success: true; prizePool: number }
                | { error?: string }
                | null;

            console.log("[Sponsor]", {
                stage: "db-sync",
                ok: syncResponse.ok,
                result: syncResult,
            });

            if (!syncResponse.ok || !syncResult || !("success" in syncResult)) {
                throw new Error(
                    syncResult && "error" in syncResult && syncResult.error
                        ? syncResult.error
                        : "Sponsorship confirmed on-chain, but DB sync failed.",
                );
            }

            await Promise.all([
                refetchPrizePool(),
                refetchAllowance(),
                refetchBalance(),
                refreshLiveChainId(),
            ]);

            setAmount("");
            setStep("success");
            setSuccessMessage(
                `${gameTitle} prize pool increased by $${formattedNetSponsorship}.`,
            );
            router.refresh();
        } catch (error) {
            const message = getContractErrorMessage(error) ?? "Sponsorship failed.";

            console.log("[Sponsor]", {
                stage: "flow-error",
                message,
            });

            setStep("error");
            setErrorMessage(message);
        }
    };

    const submitLabel = (() => {
        if (step === "connecting" || isConnecting) return "Connecting Wallet...";
        if (step === "switching") return "Switching Network...";
        if (step === "approving") return "Approving USDC...";
        if (step === "confirming-approval") return "Confirming Approval...";
        if (step === "sponsoring") return "Submitting Sponsorship...";
        if (step === "confirming-sponsorship") return "Confirming Sponsorship...";
        if (!isConnected) return "Connect Wallet";
        if (!isOnCorrectChain) return `Switch to ${targetChain.name}`;
        if (needsApproval) return "Approve & Sponsor Prize Pool";
        return "Sponsor Prize Pool";
    })();

    return (
        <div className="bg-linear-to-br from-[#14B985]/10 to-[#14B985]/5 border border-[#14B985]/20 rounded-2xl overflow-hidden">
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
                            Add funds directly from your wallet on the game&apos;s chain
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

            {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-white/10">
                    {successMessage && (
                        <div className="mb-4 p-3 bg-[#14B985]/20 border border-[#14B985]/30 rounded-xl flex items-center gap-3">
                            <CheckCircleIcon className="h-5 w-5 text-[#14B985] shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-[#14B985]">Sponsorship Successful!</p>
                                <p className="text-xs text-white/50">{successMessage}</p>
                            </div>
                        </div>
                    )}

                    {errorMessage && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3">
                            <ExclamationCircleIcon className="h-5 w-5 text-red-400 shrink-0" />
                            <p className="text-sm text-red-400">{errorMessage}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
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
                                    onChange={(event) => {
                                        setAmount(event.target.value);
                                        if (step === "success") {
                                            setStep("idle");
                                        }
                                    }}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    className="w-full pl-16 pr-20 py-4 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-medium placeholder-white/30 focus:ring-2 focus:ring-[#14B985]/50 focus:border-[#14B985] transition-all"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <span className="text-white/40 text-sm">USDC</span>
                                </div>
                            </div>

                            {isConnected && (
                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <span className="text-white/40">
                                        Balance: <span className="text-white/60">${formattedBalance} USDC</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setAmount(maxAmount)}
                                        className="text-[#14B985] hover:text-[#14B985]/80 font-medium"
                                    >
                                        Max
                                    </button>
                                </div>
                            )}

                            {isConnected && !isOnCorrectChain && (
                                <div className="mt-2 flex items-center justify-between gap-3">
                                    <p className="text-xs text-amber-300">
                                        Wrong network. Wallet is on chain {effectiveChainId ?? "unknown"} and needs to switch to {targetChain.name} ({targetChain.id}).
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            void handleSwitchNetwork();
                                        }}
                                        disabled={isWorking}
                                        className="shrink-0 rounded-lg border border-[#14B985]/40 px-3 py-1.5 text-xs font-medium text-[#14B985] hover:bg-[#14B985]/10 disabled:opacity-60"
                                    >
                                        {step === "switching" ? "Switching..." : `Switch to ${targetChain.name}`}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/50">You spend</span>
                                <span className="font-body text-white">${formattedGrossAmount}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/50">Protocol charge ({feePercent.toFixed(0)}%)</span>
                                <span className="font-body text-white/80">-${formattedSponsorshipFee}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/50">Actually added to prize pool</span>
                                <span className="font-body text-[#14B985]">${formattedNetSponsorship}</span>
                            </div>
                            <div className="h-px bg-white/10" />
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/50">Projected pool after sponsor</span>
                                <span className="font-body text-[#FFC931]">${formattedProjectedPrizePool}</span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isWorking || (!amount && isConnected)}
                            className="w-full py-4 bg-[#14B985] hover:bg-[#14B985]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#14B985]/20"
                        >
                            {isWorking || isConnecting ? (
                                <>
                                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                    {submitLabel}
                                </>
                            ) : !isConnected ? (
                                submitLabel
                            ) : !isOnCorrectChain ? (
                                <>
                                    <ArrowPathIcon className="h-5 w-5" />
                                    {submitLabel}
                                </>
                            ) : needsApproval ? (
                                <>
                                    <CheckCircleIcon className="h-5 w-5" />
                                    {submitLabel}
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="h-5 w-5" />
                                    {submitLabel}
                                </>
                            )}
                        </button>

                        {txHash && (
                            <div className="text-center">
                                <a
                                    href={getExplorerTxUrl(network, txHash)}
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
