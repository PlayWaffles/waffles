"use client";

import { useActionState } from "react";
import {
  reconcilePaidTicketAction,
  type ReconcilePaidTicketResult,
} from "@/actions/admin/tickets";

export function RecoverPaidTicketButton({ txHash }: { txHash: string }) {
  const [state, formAction, isPending] = useActionState<
    ReconcilePaidTicketResult | null,
    FormData
  >(reconcilePaidTicketAction, null);

  if (state?.success) {
    return <span className="text-xs font-medium text-[#14B985]">Recovered</span>;
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="txHash" value={txHash} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#14B985] px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-[#2cd39d] disabled:opacity-60"
      >
        {isPending ? "Recovering..." : "Recover"}
      </button>
      {state && !state.success ? (
        <span className="max-w-[220px] text-xs text-red-400">{state.error}</span>
      ) : null}
    </form>
  );
}
