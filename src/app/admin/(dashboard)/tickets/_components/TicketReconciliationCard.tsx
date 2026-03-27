"use client";

import { useActionState } from "react";
import {
  reconcilePaidTicketAction,
  type ReconcilePaidTicketResult,
} from "@/actions/admin/tickets";

export function TicketReconciliationCard() {
  const [state, formAction, isPending] = useActionState<
    ReconcilePaidTicketResult | null,
    FormData
  >(reconcilePaidTicketAction, null);

  return (
    <div className="rounded-2xl border border-[#14B985]/20 bg-[#14B985]/5 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white font-display">
          Reconcile Missing Paid Ticket
        </h2>
        <p className="mt-1 text-sm text-white/60">
          Paste a purchase tx hash to inspect the on-chain ticket, compare it to
          the DB, and create the missing paid entry directly when it is safe.
        </p>
      </div>

      <form action={formAction} className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-3">
          <label htmlFor="txHash" className="mb-2 block text-sm font-medium text-white/70">
            Transaction Hash
          </label>
          <input
            id="txHash"
            name="txHash"
            required
            placeholder="0x..."
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm text-white placeholder:text-white/25"
          />
        </div>

        <div className="md:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-[#14B985] px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-[#2cd39d] disabled:opacity-60"
          >
            {isPending ? "Checking..." : "Reconcile"}
          </button>
        </div>
      </form>

      {state && !state.success && (
        <p className="mt-4 text-sm text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="mt-4 text-sm text-[#14B985]">{state.message}</p>
      )}
    </div>
  );
}
