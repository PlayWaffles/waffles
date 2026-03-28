"use client";

import { useState } from "react";
import Link from "next/link";
import { GameActions } from "@/components/admin/GameActions";
import type { GamePhase } from "@/lib/types";
import { formatAdminGameLabel } from "@/lib/game/labels";

interface GameRowProps {
  id: string;
  platform: string;
  title: string;
  theme: string;
  startsAt: Date;
  endsAt: Date;
  playerCount: number;
  prizePool: number;
  tierPrices: unknown;
  maxPlayers: number | null;
  isTestnet: boolean;
  phase: GamePhase;
  _count: { questions: number; entries: number };
}

function GameStatusBadge({ status }: { status: string }) {
  const colors = {
    SCHEDULED: "bg-[#FFC931]/20 text-[#FFC931]",
    LIVE: "bg-[#14B985]/20 text-[#14B985]",
    ENDED: "bg-white/10 text-white/60",
    CANCELLED: "bg-red-500/20 text-red-400",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        colors[status as keyof typeof colors]
      }`}
    >
      {status === "LIVE" && (
        <span className="w-1.5 h-1.5 bg-[#14B985] rounded-full mr-1.5 animate-pulse" />
      )}
      {status}
    </span>
  );
}

export function GameRow({ game }: { game: GameRowProps }) {
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  return (
    <tr
      className={`border-b border-white/5 hover:bg-white/3 transition-colors ${
        isActionsOpen ? "relative z-50" : ""
      }`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <Link href={`/admin/games/${game.id}`} className="block group">
          <div className="font-medium text-white text-base group-hover:text-[#FFC931] transition-colors">
            {formatAdminGameLabel(game.title, game.platform)}
          </div>
          <div className="text-xs text-white/50 capitalize mt-0.5 bg-white/5 inline-block px-2 py-0.5 rounded-lg">
            {game.theme.toLowerCase()}
          </div>
        </Link>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <GameStatusBadge status={game.phase} />
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              game.isTestnet
                ? "bg-[#FFC931]/15 text-[#FFC931]"
                : "bg-[#14B985]/15 text-[#14B985]"
            }`}
          >
            {game.isTestnet ? "Testnet" : "Mainnet"}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
        {new Date(game.startsAt).toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <div className="font-medium text-[#00CFF2]">
          {game.playerCount} players
        </div>
        <div className="text-xs text-white/40">
          {game._count.entries} entries
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-[#FB72FF]">
        {game._count.questions} questions
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm relative">
        <GameActions game={{ ...game, status: game.phase }} onOpenChange={setIsActionsOpen} />
      </td>
    </tr>
  );
}
