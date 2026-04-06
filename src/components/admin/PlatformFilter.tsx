"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PLATFORMS = [
    { value: "", label: "All" },
    { value: "FARCASTER", label: "Farcaster" },
    { value: "MINIPAY", label: "MiniPay" },
    { value: "BASE_APP", label: "Base App" },
] as const;

export function PlatformFilter() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const activePlatform = searchParams.get("platform") || "";

    const handleChange = (value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set("platform", value);
        } else {
            params.delete("platform");
        }
        router.replace(`?${params.toString()}`);
    };

    return (
        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            {PLATFORMS.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => handleChange(value)}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        activePlatform === value
                            ? "bg-[#FFC931] text-[#1E1E1E] shadow-sm shadow-[#FFC931]/20"
                            : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
