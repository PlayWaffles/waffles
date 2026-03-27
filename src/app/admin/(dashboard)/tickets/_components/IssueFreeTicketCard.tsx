"use client";

import { useActionState } from "react";
import { issueFreeTicketAction, type IssueFreeTicketResult } from "@/actions/admin/tickets";

interface IssueFreeTicketCardProps {
  games: Array<{ id: string; title: string }>;
}

export function IssueFreeTicketCard({ games }: IssueFreeTicketCardProps) {
  const [state, formAction, isPending] = useActionState<IssueFreeTicketResult | null, FormData>(
    issueFreeTicketAction,
    null,
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white font-display">Issue Free Ticket</h2>
        <p className="mt-1 text-sm text-white/50">
          Grant a complimentary ticket to a user by username, wallet, fid, or user ID.
        </p>
      </div>

      <form action={formAction} className="grid gap-4 md:grid-cols-4">
        <div className="md:col-span-1">
          <label htmlFor="gameId" className="mb-2 block text-sm font-medium text-white/70">
            Game
          </label>
          <select
            id="gameId"
            name="gameId"
            required
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
            defaultValue=""
          >
            <option value="" disabled className="bg-[#0a0a0b]">
              Select game
            </option>
            {games.map((game) => (
              <option key={game.id} value={game.id} className="bg-[#0a0a0b]">
                {game.title}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <label htmlFor="userQuery" className="mb-2 block text-sm font-medium text-white/70">
            User
          </label>
          <input
            id="userQuery"
            name="userQuery"
            required
            placeholder="@username or wallet"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-white/25"
          />
        </div>

        <div className="md:col-span-1">
          <label htmlFor="note" className="mb-2 block text-sm font-medium text-white/70">
            Note
          </label>
          <input
            id="note"
            name="note"
            placeholder="Optional reason"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-white/25"
          />
        </div>

        <div className="md:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-[#FFC931] px-4 py-3 text-sm font-bold text-black transition-colors hover:bg-[#FFD966] disabled:opacity-60"
          >
            {isPending ? "Issuing..." : "Issue Ticket"}
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
