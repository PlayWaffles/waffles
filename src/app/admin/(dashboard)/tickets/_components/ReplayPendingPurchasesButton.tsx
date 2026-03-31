"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  replayPendingPurchasesAction,
  type PendingPurchaseAdminResult,
} from "@/actions/admin/tickets";

export function ReplayPendingPurchasesButton() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    PendingPurchaseAdminResult | null,
    FormData
  >(replayPendingPurchasesAction, null);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-[#14B985] px-3 py-2 text-xs font-bold text-black transition-colors hover:bg-[#2cd39d] disabled:opacity-60"
      >
        {isPending ? "Replaying..." : "Replay All Unresolved"}
      </button>
      {state ? (
        <span
          className={`max-w-[320px] text-xs ${
            state.success ? "text-[#14B985]" : "text-red-400"
          }`}
        >
          {state.success ? state.message : state.error}
        </span>
      ) : null}
    </form>
  );
}
