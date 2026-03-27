"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "waffles:admin-sidebar-collapsed";

interface AdminShellProps {
  children: ReactNode;
  username: string;
  pfpUrl: string | null;
}

export function AdminShell({
  children,
  username,
  pfpUrl,
}: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
        : null;

    if (stored === "1") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex h-screen admin-background text-white font-display">
      <aside
        className={cn(
          "relative z-10 hidden shrink-0 border-r border-white/6 transition-[width] duration-300 md:flex md:flex-col",
          isCollapsed ? "md:w-20" : "md:w-64",
        )}
      >
        <AdminSidebar
          isCollapsed={isCollapsed}
          onToggle={toggleSidebar}
        />
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader
          username={username}
          pfpUrl={pfpUrl}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
