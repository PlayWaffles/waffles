"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAdminAction } from "@/actions/admin/auth";
import {
    HomeIcon,
    UsersIcon,
    TrophyIcon,
    TicketIcon,
    ChartBarIcon,
    DocumentTextIcon,
    Cog6ToothIcon,
    ArrowRightOnRectangleIcon,
    PhotoIcon,
    StarIcon,
    RectangleGroupIcon,
    BellIcon,
    ArchiveBoxIcon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import { WaffleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Dashboard", href: "/admin", icon: HomeIcon },
    { name: "Games", href: "/admin/games", icon: TrophyIcon },
    { name: "Question Bank", href: "/admin/questions", icon: ArchiveBoxIcon },
    { name: "Users", href: "/admin/users", icon: UsersIcon },
    { name: "Notifications", href: "/admin/notifications", icon: BellIcon },
    { name: "Tickets", href: "/admin/tickets", icon: RectangleGroupIcon },
    { name: "Media Library", href: "/admin/media", icon: PhotoIcon },
    { name: "Analytics", href: "/admin/analytics", icon: ChartBarIcon },
    { name: "Audit Logs", href: "/admin/logs", icon: DocumentTextIcon },
    { name: "Settings", href: "/admin/settings", icon: Cog6ToothIcon },
];

interface AdminSidebarProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export function AdminSidebar({
    isCollapsed = false,
    onToggle,
}: AdminSidebarProps) {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col bg-linear-to-b from-[#0a0a0b]/95 to-black/98">
            {/* Logo */}
            <div
                className={cn(
                    "flex h-16 items-center border-b border-white/6 font-body",
                    isCollapsed ? "justify-center px-3" : "justify-between gap-3 px-5",
                )}
            >
                <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-3")}>
                    <WaffleIcon className="h-6 w-6 shrink-0" />
                    {!isCollapsed ? (
                        <span className="text-2xl font-bold tracking-wide text-white">
                            WAFFLES
                        </span>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white",
                        isCollapsed && "absolute right-[-14px] top-4 z-20 bg-[#131316] shadow-lg",
                    )}
                    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {isCollapsed ? (
                        <ChevronDoubleRightIcon className="h-4 w-4" />
                    ) : (
                        <ChevronDoubleLeftIcon className="h-4 w-4" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav
                className={cn(
                    "flex-1 space-y-1 overflow-y-auto py-4",
                    isCollapsed ? "px-2" : "px-3",
                )}
            >
                {navigation.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/admin" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            title={isCollapsed ? item.name : undefined}
                            className={`
                                group flex rounded-lg text-sm font-medium transition-all duration-200
                                ${isActive
                                    ? "bg-[#FFC931]/15 text-[#FFC931] border-l-3 border-[#FFC931] shadow-[0_0_20px_rgba(255,201,49,0.1)]"
                                    : "text-white/70 hover:bg-white/5 hover:text-white border-l-3 border-transparent"
                                }
                                ${isCollapsed ? "items-center justify-center px-0 py-3" : "items-center gap-3 px-3 py-2.5"}
                            `}
                        >
                            <item.icon
                                className={`h-5 w-5 shrink-0 ${isActive ? "text-[#FFC931]" : ""}`}
                                aria-hidden="true"
                            />
                            {!isCollapsed ? (
                                <span className="font-display">{item.name}</span>
                            ) : null}
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <div className={cn("border-t border-white/6 p-3", isCollapsed && "px-2")}>
                <form action={logoutAdminAction}>
                    <button
                        type="submit"
                        title={isCollapsed ? "Logout" : undefined}
                        className={cn(
                            "group flex w-full rounded-lg text-sm font-medium text-white/60 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400",
                            isCollapsed ? "items-center justify-center px-0 py-3" : "items-center gap-3 px-3 py-2.5",
                        )}
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {!isCollapsed ? (
                            <span className="font-display">Logout</span>
                        ) : null}
                    </button>
                </form>
            </div>
        </div>
    );
}
