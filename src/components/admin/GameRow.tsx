"use client";

import { useState } from "react";
import Link from "next/link";
import { GameActions } from "@/components/admin/GameActions";

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

export function GameRow({ game }: { game: any }) {
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
            {game.title}
          </div>
          <div className="text-xs text-white/50 capitalize mt-0.5 bg-white/5 inline-block px-2 py-0.5 rounded-lg">
            {game.theme.toLowerCase()}
          </div>
          <div className="ml-2 text-xs text-white/50 uppercase mt-0.5 bg-white/5 inline-block px-2 py-0.5 rounded-lg">
            {game.platform}
          </div>
        </Link>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <GameStatusBadge status={game.phase} />
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
        <GameActions game={game} onOpenChange={setIsActionsOpen} />
      </td>
    </tr>
  );
}
