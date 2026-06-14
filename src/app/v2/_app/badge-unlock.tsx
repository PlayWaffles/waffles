"use client";

import { useEffect, useRef, useState } from "react";
import { useProto } from "./state";
import { badgeById, deriveBadgeStats, earnedBadgeIds, type Badge } from "./data/badges";
import { Confetti, PixelImg } from "./shared";
import { playSound } from "./sound";

// "Badge unlocked!" celebration.
//
// A global watcher (mount once, near the app root) that derives the earned-badge
// set from game state and diffs it against a persisted `seen` baseline. On the
// very first run it silently records whatever is already earned as the baseline
// — so historical badges don't all fire at once — then celebrates anything
// earned afterwards, wherever the player happens to be. Newly earned badges
// queue and show one at a time.
//
// Derivation is shared with the Profile grid (deriveBadgeStats), so this is
// migration-safe: once state is server-side, the server can drive the same
// earned-id diff.

const SEEN_KEY = "waffles.v2.badges.seen";

const writeSeen = (ids: Set<string>) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage disabled — celebrations just won't persist as acknowledged */
  }
};

export function BadgeUnlockWatcher() {
  const proto = useProto();
  const earned = earnedBadgeIds(deriveBadgeStats(proto));
  // Stable primitive dependency so the effect only runs when the *set* changes.
  const earnedKey = earned.join(",");

  // The acknowledged set, loaded once. `null` until the first effect resolves it.
  const seenRef = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<Badge[]>([]);

  useEffect(() => {
    const earnedIds = earnedKey ? earnedKey.split(",") : [];

    if (seenRef.current === null) {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(SEEN_KEY);
      } catch {
        raw = null;
      }
      if (raw === null) {
        // First run ever: baseline = currently earned, no celebration. (Distinct
        // from a stored empty "[]", which means a fresh player with 0 badges.)
        const base = new Set(earnedIds);
        seenRef.current = base;
        writeSeen(base);
        return;
      }
      try {
        seenRef.current = new Set(JSON.parse(raw) as string[]);
      } catch {
        seenRef.current = new Set();
      }
    }

    const seen = seenRef.current;
    const fresh = earnedIds.filter((id) => !seen.has(id));
    if (fresh.length === 0) return;

    fresh.forEach((id) => seen.add(id));
    writeSeen(seen);
    const newly = fresh.map(badgeById).filter((b): b is Badge => Boolean(b));
    // Defer the state update out of the effect body (keeps it off the synchronous
    // render path and clear of the set-state-in-effect rule).
    const t = setTimeout(() => setQueue((q) => [...q, ...newly]), 0);
    return () => clearTimeout(t);
  }, [earnedKey]);

  const current = queue[0];
  return <BadgeUnlockOverlay badge={current} onDismiss={() => setQueue((q) => q.slice(1))} more={queue.length > 1} />;
}

function BadgeUnlockOverlay({ badge, onDismiss, more }: { badge: Badge | undefined; onDismiss: () => void; more: boolean }) {
  // Fanfare each time a fresh badge surfaces.
  useEffect(() => {
    if (badge) playSound("victory");
  }, [badge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!badge) return null;
  const current = badge;
  const dismiss = onDismiss;

  return (
    <div
      className="waffles-v2"
      role="dialog"
      aria-modal="true"
      aria-label={`Badge unlocked: ${current.name}`}
      onClick={dismiss}
      style={{ position: "fixed", inset: 0, zIndex: 1100, display: "grid", placeItems: "center", background: "rgba(0,0,0,.72)", padding: 28, cursor: "pointer" }}
    >
      <Confetti />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "var(--surface-2)",
          border: `1px solid ${current.accent}`,
          borderRadius: 22,
          padding: "26px 22px 20px",
          textAlign: "center",
          maxWidth: 320,
          width: "100%",
          cursor: "default",
          boxShadow: `0 16px 50px rgba(0,0,0,.6), 0 0 40px ${current.accent}33`,
          animation: "waffles-v2-onb-in .35s var(--ease-out-quart)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase", color: current.accent, fontFamily: "var(--font-display)" }}>
          Badge Unlocked
        </div>

        <div
          style={{
            width: 116,
            height: 116,
            margin: "16px auto 14px",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: `radial-gradient(circle at 35% 25%, ${current.accent}50, transparent 62%), #15151a`,
            border: `3px solid ${current.accent}`,
            boxShadow: `0 0 30px ${current.accent}77`,
            animation: "waffles-v2-badge-pop .5s var(--ease-out-quart) both",
          }}
        >
          <PixelImg src={current.icon} size={60} alt="" />
        </div>

        <div style={{ fontFamily: "var(--font-hero)", fontWeight: 800, fontSize: 28, color: "var(--ink)", lineHeight: 1.05 }}>
          {current.name}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-soft)", marginTop: 6, lineHeight: 1.4 }}>
          {current.desc}
        </div>

        <button
          type="button"
          onClick={dismiss}
          style={{ marginTop: 20, width: "100%", background: "var(--maple-500)", color: "var(--frame)", border: "2px solid var(--frame)", borderRadius: 12, padding: "12px 0", fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: 0.4, textAlign: "center", boxShadow: "0 3px 0 var(--frame)", cursor: "pointer" }}
        >
          {more ? "NEXT" : "NICE!"}
        </button>
      </div>
    </div>
  );
}
