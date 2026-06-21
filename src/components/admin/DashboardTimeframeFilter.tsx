"use client";

import { useRouter, useSearchParams } from "next/navigation";

export const DASHBOARD_TIMEFRAMES = [
    { value: "current", label: "Current Game" },
    { value: "7d", label: "7D" },
    { value: "14d", label: "14D" },
    { value: "30d", label: "30D" },
    { value: "all", label: "All Time" },
] as const;

export type DashboardTimeframe = (typeof DASHBOARD_TIMEFRAMES)[number]["value"];

type DashboardTimeframeFilterProps = {
    activeTimeframe: DashboardTimeframe;
};

export function DashboardTimeframeFilter({ activeTimeframe }: DashboardTimeframeFilterProps) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const handleChange = (value: DashboardTimeframe) => {
        const params = new URLSearchParams(searchParams);
        params.set("timeframe", value);
        router.replace(`?${params.toString()}`);
    };

    return (
        <div className="inline-flex w-fit rounded-lg border border-white/10 bg-white/5 p-0.5">
            {DASHBOARD_TIMEFRAMES.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => handleChange(value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                        activeTimeframe === value
                            ? "bg-[#FFC931] text-[#1E1E1E] shadow-sm shadow-[#FFC931]/20"
                            : "text-white/50 hover:bg-white/5 hover:text-white/80"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
