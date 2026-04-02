"use client";

import { useState, useTransition } from "react";
import { roundupGameAction } from "@/actions/admin/games";

export function RoundupButton({
  gameId,
  isPublished = false,
}: {
  gameId: string;
  isPublished?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    entriesRanked: number;
    prizesDistributed: number;
    published: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPublished) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await roundupGameAction(gameId);
      if (res.success) {
        setResult({
          entriesRanked: res.entriesRanked!,
          prizesDistributed: res.prizesDistributed!,
          published: res.published!,
        });
      } else {
        setError(res.error ?? "Roundup failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending || isPublished}
        className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-xl transition-all text-sm font-bold ${
          isPublished
            ? "bg-[#00CFF2]/20 text-[#00CFF2] shadow-none cursor-not-allowed"
            : "bg-[#14B985] hover:bg-[#14B985]/80 shadow-lg shadow-[#14B985]/20"
        } disabled:opacity-70`}
      >
        {isPublished ? (
          "Published On-Chain"
        ) : isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Publishing...
          </>
        ) : (
          "Publish Results"
        )}
      </button>

      {result && (
        <span className="text-xs text-[#14B985]">
          {result.entriesRanked} ranked, {result.prizesDistributed} winners
          {result.published ? ", on-chain" : ""}
        </span>
      )}

      {isPublished && !result && !error && (
        <span className="text-xs text-[#00CFF2]">Results already published on-chain</span>
      )}

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
