"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { PixelButton } from "@/components/ui/PixelButton";
import { motion } from "framer-motion";

type TabKey = "current" | "allTime";

interface TabsProps {
  activeTab: TabKey;
  gameNumber?: number | null;
  prevGameId?: string;
  nextGameId?: string;
  onNavigateGame?: (gameId: string) => void;
}

export function Tabs({ activeTab, gameNumber, prevGameId, nextGameId, onNavigateGame }: TabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState(148);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const arrowSpace = activeTab === "current" ? 72 : 0; // 2 arrows ~36px each
      const gap = 8; // gap-2
      const available = el.clientWidth - arrowSpace - gap;
      // Round down to nearest 4 (PixelButton grid requirement)
      const perButton = Math.floor(available / 2 / 4) * 4;
      setButtonWidth(Math.max(120, Math.min(perButton, 180)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  const currentLabel = gameNumber
    ? `WAFFLES #${gameNumber.toString().padStart(3, "0")}`
    : "Current";

  const tabs: { key: TabKey; label: string }[] = [
    { key: "current", label: currentLabel },
    { key: "allTime", label: "All time" },
  ];

  const handleTabChange = useCallback(
    (newTab: TabKey) => {
      router.push(`${pathname}?tab=${newTab}`, { scroll: false });
    },
    [router, pathname]
  );

  return (
    <motion.div
      ref={containerRef}
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex w-full items-center justify-center gap-2"
      role="tablist"
    >
      {/* Prev game arrow */}
      {activeTab === "current" && (
        <button
          onClick={() => prevGameId && onNavigateGame?.(prevGameId)}
          disabled={!prevGameId}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-20 enabled:hover:bg-white/10 enabled:active:scale-90"
          aria-label="Previous game"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
      )}

      {tabs.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <div key={key} className="relative">
            <PixelButton
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(key)}
              tabIndex={isActive ? 0 : -1}
              variant={isActive ? "filled" : "outline"}
              width={buttonWidth}
              height={44}
            >
              {label}
            </PixelButton>
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-waffle-yellow"
              />
            )}
          </div>
        );
      })}

      {/* Next game arrow */}
      {activeTab === "current" && (
        <button
          onClick={() => nextGameId && onNavigateGame?.(nextGameId)}
          disabled={!nextGameId}
          className="p-1.5 rounded-lg transition-colors disabled:opacity-20 enabled:hover:bg-white/10 enabled:active:scale-90"
          aria-label="Next game"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      )}
    </motion.div>
  );
}

// Re-export for client
export type { TabKey as LeaderboardTabKey };
