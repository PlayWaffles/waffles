"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export function UserFilters() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("q", term);
        } else {
            params.delete("q");
        }
        router.replace(`?${params.toString()}`);
    }, 300);

    const handleRoleChange = (role: string) => {
        const params = new URLSearchParams(searchParams);
        if (role) {
            params.set("role", role);
        } else {
            params.delete("role");
        }
        router.replace(`?${params.toString()}`);
    };

    const handleStatusChange = (status: string) => {
        const params = new URLSearchParams(searchParams);
        if (status) {
            params.set("status", status);
        } else {
            params.delete("status");
        }
        router.replace(`?${params.toString()}`);
    };

    return (
        <div className="rounded-2xl border border-white/10 p-4">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                    <input
                        type="text"
                        placeholder="Search by username, wallet address, or FID..."
                        className="w-full pl-10 pr-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-[#FFC931]/20 focus:border-[#FFC931]/50 transition-all"
                        defaultValue={searchParams.get("q")?.toString()}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white/60 focus:ring-2 focus:ring-[#FFC931]/20 focus:border-[#FFC931]/50 transition-all"
                    defaultValue={searchParams.get("role")?.toString()}
                    onChange={(e) => handleRoleChange(e.target.value)}
                >
                    <option value="" className="bg-[#0a0a0b]">All Roles</option>
                    <option value="USER" className="bg-[#0a0a0b]">User</option>
                    <option value="ADMIN" className="bg-[#0a0a0b]">Admin</option>
                </select>
                <select
                    className="px-4 py-2.5 bg-transparent border border-white/10 rounded-xl text-white/60 focus:ring-2 focus:ring-[#FFC931]/20 focus:border-[#FFC931]/50 transition-all"
                    defaultValue={searchParams.get("status")?.toString()}
                    onChange={(e) => handleStatusChange(e.target.value)}
                >
                    <option value="" className="bg-[#0a0a0b]">All Statuses</option>
                    <option value="ACTIVE" className="bg-[#0a0a0b]">Active</option>
                    <option value="BANNED" className="bg-[#0a0a0b]">Banned</option>
                </select>
            </div>
        </div>
    );
}
