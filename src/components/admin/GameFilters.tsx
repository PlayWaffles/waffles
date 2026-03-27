"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { PlatformFilter } from "./PlatformFilter";

const STATUSES = [
    { value: "", label: "All Statuses" },
    { value: "SCHEDULED", label: "Scheduled" },
    { value: "LIVE", label: "Live" },
    { value: "ENDED", label: "Ended" },
    { value: "CANCELLED", label: "Cancelled" },
] as const;

export function GameFilters() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const updateParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.set("page", "1");
        router.replace(`?${params.toString()}`);
    };

    const handleSearch = useDebouncedCallback((term: string) => {
        updateParam("search", term);
    }, 300);

    return (
        <div className="rounded-2xl border border-white/10 p-4 space-y-4">
            {/* Platform segmented control */}
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white/40 uppercase tracking-wider mr-1">
                    Platform
                </span>
                <PlatformFilter />
            </div>

            {/* Search + status row */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <input
                        type="text"
                        placeholder="Search games by title..."
                        className="w-full pl-10 pr-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFC931]/20 focus:border-[#FFC931]/50 transition-all"
                        defaultValue={searchParams.get("search")?.toString()}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white/60 focus:ring-2 focus:ring-[#FFC931]/20 focus:border-[#FFC931]/50 transition-all"
                    defaultValue={searchParams.get("status")?.toString() || ""}
                    onChange={(e) => updateParam("status", e.target.value)}
                >
                    {STATUSES.map(({ value, label }) => (
                        <option key={value} value={value} className="bg-[#0a0a0b]">
                            {label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
