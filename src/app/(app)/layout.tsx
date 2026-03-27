// Mini app root layout
import { Providers } from "@/components/providers";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "Waffles",
        description: "Pattern-matching tournaments built for MiniPay on Celo.",
    };
}
export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Providers>
            <main className="h-dvh flex flex-col overflow-hidden app-background">
                {children}
            </main>
        </Providers>
    );
}
