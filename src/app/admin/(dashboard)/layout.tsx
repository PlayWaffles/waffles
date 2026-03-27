import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import GlobalToaster from "@/components/ui/Toaster";
import { fontBody, fontDisplay } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { AdminOnchainProvider } from "@/components/admin/AdminOnchainProvider";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getAdminSession();

    if (!session) {
        redirect("/admin/login");
    }

    return (
        <AdminOnchainProvider>
            <div
                className={cn(
                    "font-display text-white",
                    fontBody.variable,
                    fontDisplay.variable,
                )}
            >
                <AdminShell
                    username={session.username || "Admin"}
                    pfpUrl={session.pfpUrl || null}
                >
                    {children}
                </AdminShell>
            </div>
            <GlobalToaster />
        </AdminOnchainProvider>
    );
}
