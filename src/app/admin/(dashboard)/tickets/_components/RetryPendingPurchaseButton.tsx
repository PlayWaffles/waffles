"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  retryPendingPurchaseAction,
  type PendingPurchaseAdminResult,
} from "@/actions/admin/tickets";

export function RetryPendingPurchaseButton({ txHash }: { txHash: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    PendingPurchaseAdminResult | null,
    FormData
  >(retryPendingPurchaseAction, null);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state]);

  if (state?.success) {
    return <span className="text-xs font-medium text-[#14B985]">Synced</span>;
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="txHash" value={txHash} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#FFC931] px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-[#ffd95f] disabled:opacity-60"
      >
        {isPending ? "Retrying..." : "Retry"}
      </button>
      {state && !state.success ? (
        <span className="max-w-[220px] text-xs text-red-400">{state.error}</span>
      ) : null}
    </form>
  );
}
