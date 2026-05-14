"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setMiniPayTestnetCookie } from "@/lib/client/runtime";

interface MiniPayNetworkToggleProps {
    initialShowTestnet: boolean;
}

export function MiniPayNetworkToggle({
    initialShowTestnet,
}: MiniPayNetworkToggleProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showTestnet, setShowTestnet] = useState(initialShowTestnet);

    const modeLabel = showTestnet ? "Mainnet + testnet" : "Mainnet only";

    return (
        <div className="bg-linear-to-br from-[#14B985]/5 to-transparent rounded-2xl border border-white/10 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-1 font-display">
                        MiniPay Game Visibility
                    </h3>
                    <p className="text-white/50 text-sm">
                        Choose whether this browser shows only Celo mainnet MiniPay games or includes MiniPay testnet games for admin checks.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        const nextValue = !showTestnet;
                        setShowTestnet(nextValue);
                        setMiniPayTestnetCookie(nextValue);
                        startTransition(() => {
                            router.refresh();
                        });
                    }}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#FFC931]/25 bg-[#FFC931]/10 px-4 py-2 text-sm font-bold text-[#FFC931] transition-colors hover:bg-[#FFC931]/20 disabled:cursor-wait disabled:opacity-60"
                    aria-pressed={showTestnet}
                    disabled={isPending}
                >
                    {modeLabel}
                </button>
            </div>
        </div>
    );
}
