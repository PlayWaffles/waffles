import SettingsClient from "./client";
import Link from "next/link";
import { LinkIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import { cookies } from "next/headers";
import { MiniPayNetworkToggle } from "@/components/admin/MiniPayNetworkToggle";
import {
    MINIPAY_TESTNET_COOKIE,
    parseMiniPayTestnetPreference,
} from "@/lib/platform/constants";

export default async function AdminSettingsPage() {
    const cookieStore = await cookies();
    const showMiniPayTestnet =
        parseMiniPayTestnetPreference(cookieStore.get(MINIPAY_TESTNET_COOKIE)?.value) === true;

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white font-display">Settings</h1>
                <p className="text-white/60 mt-1">Admin dashboard settings and configuration</p>
            </div>

            {/* Quick Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    href="/admin/settings/contract"
                    className="bg-linear-to-br from-[#FFC931]/5 to-transparent rounded-2xl border border-white/10 p-5 group hover:border-[#FFC931]/30 transition-colors"
                >
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#FFC931]/10 rounded-xl group-hover:bg-[#FFC931]/20 transition-colors">
                            <LinkIcon className="h-6 w-6 text-[#FFC931]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white font-display mb-1">
                                Contract Management
                            </h3>
                            <p className="text-white/50 text-sm">
                                View on-chain contract state, fees, and configuration.
                            </p>
                        </div>
                    </div>
                </Link>

                <div className="bg-linear-to-br from-white/5 to-transparent rounded-2xl border border-white/10 p-5 opacity-50 cursor-not-allowed">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white/10 rounded-xl">
                            <Cog6ToothIcon className="h-6 w-6 text-white/50" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white font-display mb-1">
                                General Settings
                            </h3>
                            <p className="text-white/50 text-sm">
                                Coming soon...
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <MiniPayNetworkToggle initialShowTestnet={showMiniPayTestnet} />

            <SettingsClient />
        </div>
    );
}
