"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";

import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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

  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

  return (
    <div className="flex h-screen admin-background text-white font-display">
      {/* Desktop sidebar */}
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

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-white/6 md:hidden">
            <AdminSidebar isCollapsed={false} onToggle={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader
          username={username}
          pfpUrl={pfpUrl}
          onMenuToggle={toggleMobile}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
