"use client";

import { createGameAction } from "@/actions/admin/games";
import { GameForm } from "@/components/admin/GameForm";
import Link from "next/link";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

export default function CreateGamePage() {
  return (
    <div className="py-4">
      {/* Header */}
      <div className="max-w-3xl mx-auto mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/games"
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white font-display">Create Game</h1>
            <p className="text-sm text-white/50">
              Launch a movie game with auto-selected questions
            </p>
          </div>
        </div>
      </div>

      {/* Game Form */}
      <GameForm action={createGameAction} />
    </div>
  );
}
