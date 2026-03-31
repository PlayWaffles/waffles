"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  reconcilePaidTicketToUserAction,
  type ReconcilePaidTicketResult,
} from "@/actions/admin/tickets";

export function ResolveOnchainPurchaseButton({
  txHash,
}: {
  txHash: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    ReconcilePaidTicketResult | null,
    FormData
  >(reconcilePaidTicketToUserAction, null);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state]);

  if (state?.success) {
    return <span className="text-xs font-medium text-[#14B985]">Recovered</span>;
  }

  return (
    <form action={formAction} className="flex min-w-[220px] flex-col items-start gap-2">
      <input type="hidden" name="txHash" value={txHash} />
      <input
        type="text"
        name="userQuery"
        required
        placeholder="@username"
        className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-white/25"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#FFC931] px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-[#ffd95f] disabled:opacity-60"
      >
        {isPending ? "Resolving..." : "Resolve User"}
      </button>
      {state && !state.success ? (
        <span className="max-w-[220px] text-xs text-red-400">{state.error}</span>
      ) : null}
    </form>
  );
}
