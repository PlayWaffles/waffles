// Mini app root layout
import { Providers } from "@/components/providers";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: "Waffles",
        description: "Guess the movie scene. Win real prizes.",
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
