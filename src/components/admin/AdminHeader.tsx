"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import {
    ArrowRightEndOnRectangleIcon,
    WalletIcon,
    Bars3Icon,
} from "@heroicons/react/24/outline";

interface AdminHeaderProps {
    username: string;
    pfpUrl: string | null;
    onMenuToggle?: () => void;
}

export function AdminHeader({ username, pfpUrl, onMenuToggle }: AdminHeaderProps) {
    const { isConnected, address, chain } = useAccount();

    const { connect, connectors, isPending: isConnecting } = useConnect();
    const { disconnect } = useDisconnect();
    const preferredConnector = connectors.find((connector) => connector.id === "injected") || connectors[0];


    return (
        <header className="bg-[#0a0a0b]/80 border-b border-white/6 backdrop-blur-xl flex h-16 items-center justify-between px-4 md:px-6">
            {/* Left: Menu + Title */}
            <div className="flex items-center gap-3">
                {onMenuToggle && (
                    <button
                        type="button"
                        onClick={onMenuToggle}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors md:hidden"
                        aria-label="Open navigation menu"
                    >
                        <Bars3Icon className="h-6 w-6" />
                    </button>
                )}
                <h2 className="text-lg font-semibold text-white font-body">
                    Admin Dashboard
                </h2>
            </div>

            {/* Right: Wallet + User */}
            <div className="flex items-center gap-3">
                {/* Wallet Section */}
                {isConnected ? (
                    <div className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs ${chain
                            ? "bg-[#14B985]/10 text-[#14B985]"
                            : "bg-white/10 text-white/60"
                            }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${chain ? "bg-[#14B985]" : "bg-white/40"
                                }`} />
                            <span className="font-medium">{chain?.name}</span>
                            <span className="text-white/30">·</span>
                            <span className="text-white/50 font-mono">
                                {address?.slice(0, 4)}...{address?.slice(-3)}
                            </span>
                        </div>
                        <button
                            onClick={() => disconnect()}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="Disconnect"
                        >
                            <ArrowRightEndOnRectangleIcon className="h-4 w-4 text-white/40 hover:text-red-400" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => {
                            if (!preferredConnector) return;
                            connect({ connector: preferredConnector });
                        }}
                        disabled={isConnecting || !preferredConnector}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FFC931]/10 hover:bg-[#FFC931]/20 rounded-lg text-xs font-medium text-[#FFC931] transition-colors disabled:opacity-50"
                    >
                        <WalletIcon className="h-3.5 w-3.5" />
                        {isConnecting ? "Connecting..." : "Connect"}
                    </button>
                )}

                {/* Divider */}
                <div className="w-px h-6 bg-white/10" />

                {/* User Section */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">
                        {username}
                    </span>
                    {pfpUrl ? (
                        <img
                            src={pfpUrl}
                            alt={username}
                            className="h-7 w-7 rounded-full ring-1 ring-white/10 object-cover"
                        />
                    ) : (
                        <div className="h-7 w-7 rounded-full bg-linear-to-br from-[#FFC931] to-[#00CFF2] flex items-center justify-center text-black font-bold text-xs ring-1 ring-white/10">
                            {username?.[0]?.toUpperCase() || "A"}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
