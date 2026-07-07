"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  syncRecoverableOnchainPurchasesAction,
  type SyncOnchainPurchasesResult,
} from "@/actions/admin/tickets";

export function SyncOnchainPurchasesButton({
  txHashes,
}: {
  txHashes: string[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    SyncOnchainPurchasesResult | null,
    FormData
  >(syncRecoverableOnchainPurchasesAction, null);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
      {txHashes.map((txHash) => (
        <input key={txHash} type="hidden" name="txHash" value={txHash} />
      ))}
      <button
        type="submit"
        disabled={isPending || txHashes.length === 0}
        className="rounded-lg bg-[#14B985] px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-[#2cd39d] disabled:opacity-60"
      >
        {isPending ? "Syncing..." : `Sync ${txHashes.length} recoverable`}
      </button>
      {state?.success ? (
        <span className="max-w-[320px] text-right text-xs text-[#14B985]">
          {state.message}
        </span>
      ) : state ? (
        <span className="max-w-[320px] text-right text-xs text-red-400">
          {state.error}
        </span>
      ) : null}
      {state?.success && state.errors.length > 0 ? (
        <span className="max-w-[320px] text-right text-xs text-red-300">
          {state.errors.join(" ")}
        </span>
      ) : null}
    </form>
  );
}
