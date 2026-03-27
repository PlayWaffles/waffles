"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChartBarIcon, BoltIcon, BanknotesIcon } from "@heroicons/react/24/outline";

const TABS = [
    { id: "overview", label: "Overview", icon: ChartBarIcon },
    { id: "games", label: "Gameplay", icon: BoltIcon },
    { id: "players", label: "Revenue & Retention", icon: BanknotesIcon },
] as const;

export type AnalyticsTab = (typeof TABS)[number]["id"];

interface AnalyticsTabsProps {
    currentTab: AnalyticsTab;
}

export function AnalyticsTabs({ currentTab }: AnalyticsTabsProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleTabChange = (tab: AnalyticsTab) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    return (
        <div className="rounded-2xl border border-white/10 p-1.5 inline-flex items-center gap-1">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive
                                ? "bg-[#FFC931] text-black font-bold shadow-lg shadow-[#FFC931]/20"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
