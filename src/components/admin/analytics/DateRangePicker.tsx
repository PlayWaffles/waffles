"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { DATE_PRESETS } from "./dateUtils";

interface DateRangePickerProps {
    currentRange: string;
    startDate?: string;
    endDate?: string;
}

export function DateRangePicker({ currentRange, startDate, endDate }: DateRangePickerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [customStartDate, setCustomStartDate] = useState(startDate ?? "");
    const [customEndDate, setCustomEndDate] = useState(endDate ?? "");
    const isCustomRangeInvalid = !customStartDate || !customEndDate || customStartDate > customEndDate;

    const handleRangeChange = (range: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("range", range);
        params.delete("startDate");
        params.delete("endDate");
        router.push(`?${params.toString()}`);
    };

    const handleCustomRangeApply = () => {
        if (isCustomRangeInvalid) {
            return;
        }

        const params = new URLSearchParams(searchParams);
        params.set("range", "custom");
        params.set("startDate", customStartDate);
        params.set("endDate", customEndDate);
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="rounded-2xl border border-white/10 p-2 inline-flex flex-wrap items-center gap-1">
            <CalendarIcon className="h-4 w-4 text-white/40 ml-2 mr-1" />
            {DATE_PRESETS.map((preset) => (
                <button
                    key={preset.value}
                    onClick={() => handleRangeChange(preset.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${currentRange === preset.value
                            ? "bg-[#FFC931] text-black font-bold shadow-lg shadow-[#FFC931]/20"
                            : "text-white/60 hover:text-white hover:bg-white/5"
                        }`}
                >
                    {preset.label}
                </button>
            ))}
            <div className="ml-1 flex items-center gap-1 border-l border-white/10 pl-2">
                <input
                    type="date"
                    aria-label="Start date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    className={`h-8 rounded-lg border px-2 text-xs outline-none transition sm:w-[132px] ${
                        currentRange === "custom"
                            ? "border-[#FFC931]/50 bg-[#FFC931]/10 text-white"
                            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                    }`}
                />
                <input
                    type="date"
                    aria-label="End date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    className={`h-8 rounded-lg border px-2 text-xs outline-none transition sm:w-[132px] ${
                        currentRange === "custom"
                            ? "border-[#FFC931]/50 bg-[#FFC931]/10 text-white"
                            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                    }`}
                />
                <button
                    type="button"
                    onClick={handleCustomRangeApply}
                    disabled={isCustomRangeInvalid}
                    className="h-8 rounded-lg bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    Apply
                </button>
            </div>
        </div>
    );
}
