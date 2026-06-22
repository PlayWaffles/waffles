"use client";

import { OnchainKitProvider as OnchainKitProviderComponent } from "@coinbase/onchainkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { env } from "@/lib/env";
import { getPlatformChain } from "@/lib/chain";
import { wagmiConfig, wagmiQueryClient } from "@/lib/wagmi/config";

interface Props {
    children: React.ReactNode;
}

/**
 * AdminOnchainProvider
 * 
 * Lightweight OnchainKit wrapper for admin dashboard.
 * Enables wallet connection for on-chain operations (sponsoring, etc.)
 * without the full minikit config used in the main app.
 */
export function AdminOnchainProvider({ children }: Props) {
    const adminChain = getPlatformChain("BASE_APP");

    return (
        <QueryClientProvider client={wagmiQueryClient}>
            <WagmiProvider config={wagmiConfig}>
                <OnchainKitProviderComponent
                    apiKey={env.nextPublicOnchainkitApiKey}
                    chain={adminChain}
                    config={{
                        appearance: {
                            mode: "dark",
                        },
                        wallet: {
                            display: "modal",
                        },
                    }}
                >
                    {children}
                </OnchainKitProviderComponent>
            </WagmiProvider>
        </QueryClientProvider>
    );
}
