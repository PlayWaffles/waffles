"use client";

import { useEffect, useRef, useState } from "react";
import { WinnersCard, WINNERS_CARD_W, WINNERS_CARD_H, type WinnerEntry } from "@/components/winners/WinnersCard";
import { downloadWinnersPng, ensureWinnersFonts } from "@/components/winners/exportWinners";
import { resolveAvatar } from "@/player/shared";

export type AdminWinner = {
  rank: number;
  name: string;
  score: number;
  prize: number;
  avatarId: string | null;
  /** Seed for a deterministic fallback avatar when the user has no avatarId. */
  seed: string;
};

export function WinnersExportButton({
  title,
  category,
  pool,
  currency,
  winners,
  winnerCount,
  fileSlug,
}: {
  title: string;
  category: string;
  pool: number;
  currency: string;
  winners: AdminWinner[];
  winnerCount: number;
  fileSlug: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ensureWinnersFonts();
  }, []);

  const entries: WinnerEntry[] = winners.map((w) => ({
    rank: w.rank,
    name: w.name,
    score: w.score,
    prize: w.prize,
    avatar: resolveAvatar(w.avatarId, w.seed),
  }));

  const onExport = async () => {
    if (!cardRef.current || entries.length === 0) return;
    setBusy(true);
    try {
      await downloadWinnersPng(cardRef.current, `waffles-winners-${fileSlug}`);
    } catch (err) {
      console.error("[winners-export] failed", err);
      alert("Couldn't export the winners image. See console for details.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onExport}
        disabled={busy || entries.length === 0}
        className="inline-flex items-center gap-2 rounded-lg bg-[#FFC931] px-4 py-2 text-sm font-semibold text-[#1E1E1E] transition-colors hover:bg-[#ffd75a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Exporting…" : "🏆 Export winners image"}
      </button>

      {/* Off-screen full-size render target for the capture (kept opaque so the
          PNG isn't blank; just positioned out of view). */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, width: WINNERS_CARD_W, height: WINNERS_CARD_H, pointerEvents: "none", zIndex: -1 }}>
        <WinnersCard ref={cardRef} title={title} category={category} pool={pool} currency={currency} winners={entries} winnerCount={winnerCount} />
      </div>
    </>
  );
}
