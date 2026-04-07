"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";

import { Tabs, LeaderboardTabKey } from "./_components/Tabs";
import { Top3 } from "./_components/Top3";
import { Row } from "./_components/Row";
import { WaffleLoader } from "@/components/ui/WaffleLoader";
import { LeaderboardEntry } from "@/lib/types";
import { useUser } from "@/hooks/useUser";

// ============================================
// TYPES
// ============================================
interface APIResponse {
  entries: LeaderboardEntry[];
  hasMore: boolean;
  totalPlayers: number;
  gameTitle?: string;
  gameNumber?: number;
  prevGameId?: string;
  nextGameId?: string;
}

// ============================================
// CONSTANTS
// ============================================
const CROWN_HEIGHT = 180;

// ============================================
// COMPONENT
// ============================================
export default function LeaderboardClient() {
  // ── URL Params ────────────────────────────────
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId");
  const tab = searchParams.get("tab");
  const activeTab: LeaderboardTabKey = tab === "allTime" ? "allTime" : "current";

  // ── User Context ──────────────────────────────
  const { user } = useUser();
  const currentUserId = user?.id ?? null;

  // ── State ─────────────────────────────────────
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crownOpacity, setCrownOpacity] = useState(1);
  const [isSticky, setIsSticky] = useState(false);
  const [gameTitle, setGameTitle] = useState("Game");
  const [gameNumber, setGameNumber] = useState<number | null>(null);
  const [prevGameId, setPrevGameId] = useState<string | undefined>();
  const [nextGameId, setNextGameId] = useState<string | undefined>();

  // ── Refs ──────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Data Fetching ─────────────────────────────
  const fetchPage = useCallback(async (pageNum: number, isReset: boolean) => {
    // Cancel previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isReset) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Build query params
      const params = new URLSearchParams({ page: String(pageNum) });
      if (gameId) params.set("gameId", gameId);
      else if (activeTab === "allTime") params.set("tab", "allTime");

      const res = await fetch(`/api/v1/leaderboard?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: APIResponse = await res.json();

      if (controller.signal.aborted) return;

      // Update state
      if (isReset) {
        setEntries(data.entries);
        setGameTitle(data.gameTitle ?? "Game");
        setGameNumber(data.gameNumber ?? null);
        setPrevGameId(data.prevGameId);
        setNextGameId(data.nextGameId);
        posthog.capture("leaderboard_viewed", {
          tab: gameId ? "game" : activeTab,
          game_id: gameId ?? undefined,
          game_number: data.gameNumber,
          total_players: data.totalPlayers,
        });
      } else {
        setEntries(prev => [...prev, ...data.entries]);
      }
      setHasMore(data.hasMore);
      setPage(pageNum + 1);

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[Leaderboard] Fetch error:", err);
      setError(isReset ? "Failed to load leaderboard." : "Failed to load more.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, [activeTab, gameId]);

  // ── Effects ───────────────────────────────────
  // Initial fetch + refetch on param change
  useEffect(() => {
    setPage(0);
    setCrownOpacity(1);
    scrollRef.current?.scrollTo(0, 0);
    fetchPage(0, true);
  }, [fetchPage]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) fetchPage(page, false); },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, page, fetchPage]);

  // ── Handlers ──────────────────────────────────
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const y = e.currentTarget.scrollTop;
    setCrownOpacity(Math.max(0, Math.min(1, 1 - y / CROWN_HEIGHT)));
    setIsSticky(y >= CROWN_HEIGHT);
  }, []);

  // ── Navigation ────────────────────────────────
  const navigateGame = useCallback((targetGameId: string) => {
    router.push(`/leaderboard?gameId=${targetGameId}`, { scroll: false });
  }, [router]);

  // ── Computed ──────────────────────────────────
  const isEmpty = entries.length === 0;
  const showTop3 = entries.length >= 3;
  const top3 = showTop3 ? entries.slice(0, 3) : [];
  const rest = showTop3 ? entries.slice(3) : entries;
  const subtitle = activeTab === "current" ? gameTitle : "The greatest wafflers of all time";

  // ── Render ────────────────────────────────────
  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto flex flex-col px-3">

      {/* Crown Image */}
      <div
        className="pt-6 grid place-items-center transition-opacity duration-150 relative z-0"
        style={{
          opacity: crownOpacity,
          pointerEvents: crownOpacity < 0.1 ? "none" : "auto",
          marginBottom: "-60px",
        }}
      >
        <Image
          src="/images/chest-crown.png"
          alt=""
          width={320}
          height={260}
          priority
          className="h-[180px] w-auto"
          style={{ transform: `scale(${0.95 + crownOpacity * 0.05})` }}
        />
      </div>

      {/* Sticky Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 -mx-3 px-3 pt-8 pb-6"
        style={{
          background: isSticky
            ? "linear-gradient(to bottom, #0A0A0C 0%, #0A0A0C 70%, transparent 100%)"
            : "linear-gradient(to bottom, transparent 0%, #0A0A0C 30%, #0A0A0C 70%, transparent 100%)",
        }}
      >
        <h1 className="text-center font-body text-[36px] tracking-[1px]">LEADERBOARD</h1>
        <div className="mt-4 flex justify-center">
          <Tabs
            activeTab={activeTab}
            gameNumber={gameNumber}
            prevGameId={activeTab === "current" ? prevGameId : undefined}
            nextGameId={activeTab === "current" ? nextGameId : undefined}
            onNavigateGame={navigateGame}
          />
        </div>
        <p className="mt-3 text-center text-muted font-display text-sm">{subtitle}</p>
      </motion.header>

      {/* List */}
      <section className="pb-24 pt-4 space-y-4">

        {/* Loading */}
        {isLoading && isEmpty && (
          <div className="py-8 flex justify-center">
            <WaffleLoader size={80} text="Loading..." />
          </div>
        )}

        {/* Top 3 */}
        <AnimatePresence mode="wait">
          {showTop3 && (
            <motion.div
              key={`top3-${activeTab}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Top3 entries={top3} currentUserId={currentUserId} showScore={activeTab === "current"} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rows */}
        <div className="space-y-3">
          {rest.map((entry) => (
            <Row
              key={`${activeTab}-${entry.rank}-${entry.id}`}
              entry={entry}
              isCurrentUser={currentUserId != null && entry.userId === currentUserId}
              showScore={activeTab === "current"}
            />
          ))}
        </div>

        {/* Pagination Loader */}
        {isLoading && !isEmpty && (
          <div className="py-4 flex justify-center">
            <WaffleLoader size={60} text="" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-danger/20 border border-danger/40 px-3 py-3 text-sm text-danger text-center rounded-xl">
            {error}
          </div>
        )}

        {/* Empty */}
        {isEmpty && !error && !isLoading && (
          <div className="flex items-center justify-center py-6 px-4 border border-white/10 rounded-2xl bg-white/5">
            <p className="font-display text-sm text-white/40">No rankings yet</p>
          </div>
        )}

        {/* Infinite Scroll Trigger */}
        {hasMore && !isLoading && !error && <div ref={loaderRef} className="h-10" />}

        {/* End */}
        {!hasMore && !isEmpty && !error && !isLoading && (
          <p className="py-3 text-center text-sm text-white/30 font-display">— End of leaderboard —</p>
        )}
      </section>
    </div>
  );
}
