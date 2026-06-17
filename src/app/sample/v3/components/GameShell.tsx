"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Full-bleed dark play surface that mirrors the live game background, with a
 * lightweight top bar to return to the Format Lab gallery.
 */
export function GameShell({
  title,
  subtitle,
  onExit,
  children,
}: {
  title: string;
  subtitle?: string;
  onExit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--brand-black)] text-white">
      <header className="flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to formats"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <p className="truncate font-body text-[17px] leading-none">{title}</p>
          {subtitle ? (
            <p className="mt-1 truncate font-display text-[11px] uppercase tracking-wider text-white/45">
              {subtitle}
            </p>
          ) : null}
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
        {children}
      </div>
    </div>
  );
}
