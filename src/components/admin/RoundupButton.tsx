"use client";

import { useState, useTransition } from "react";
import { roundupGameAction } from "@/actions/admin/games";

export function RoundupButton({ gameId }: { gameId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    entriesRanked: number;
    prizesDistributed: number;
    published: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await roundupGameAction(gameId);
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Roundup failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#14B985] hover:bg-[#14B985]/80 disabled:opacity-50 text-white rounded-xl transition-all text-sm font-bold shadow-lg shadow-[#14B985]/20"
      >
        {isPending ? (
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

      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
