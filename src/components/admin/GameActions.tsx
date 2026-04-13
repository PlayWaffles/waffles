"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  EllipsisVerticalIcon,
  PencilIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { DeleteGameButton } from "@/components/admin/DeleteGameButton";

interface GameActionsProps {
  game: {
    id: string;
    title: string;
    status: string;
    _count: {
      questions: number;
    };
  };
  onOpenChange?: (isOpen: boolean) => void;
}

export function GameActions({ game, onOpenChange }: GameActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0, openUpward: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Calculate position with viewport boundary detection
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 200; // Approximate dropdown height
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const openUpward = spaceBelow < menuHeight && rect.top > menuHeight;

      setPosition({
        top: openUpward
          ? rect.top + window.scrollY - menuHeight + 8
          : rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right,
        openUpward,
      });
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => toggleOpen(!isOpen)}
        className={`p-2.5 rounded-xl transition-all duration-200 ${isOpen
            ? "bg-[#FFC931]/20 text-[#FFC931] ring-2 ring-[#FFC931]/30"
            : "text-white/50 hover:text-white hover:bg-white/10"
          }`}
        title="More actions"
        aria-label="More actions"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop with subtle blur */}
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
              onClick={() => toggleOpen(false)}
            />

            {/* Dropdown Menu - Dark theme matching app */}
            <div
              ref={menuRef}
              className={`fixed w-56 rounded-2xl shadow-2xl border border-white/10 py-2 z-50 animate-in ${position.openUpward ? "slide-in-from-bottom-2" : "slide-in-from-top-2"
                } duration-150`}
              style={{
                top: `${position.top}px`,
                right: `${position.right}px`,
                background: "linear-gradient(180deg, #252525 0%, #1a1a1a 100%)",
              }}
            >
              {/* View Details */}
              <Link
                href={`/admin/games/${game.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#FFC931] hover:bg-white/5 transition-colors mx-2 rounded-xl"
                onClick={() => toggleOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-[#FFC931]/10 flex items-center justify-center">
                  <EyeIcon className="h-4 w-4" />
                </div>
                View Details
              </Link>

              {/* Edit Game */}
              <Link
                href={`/admin/games/${game.id}/edit`}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors mx-2 rounded-xl"
                onClick={() => toggleOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <PencilIcon className="h-4 w-4" />
                </div>
                Edit Game
              </Link>

              {/* Manage Questions */}
              <Link
                href={`/admin/games/${game.id}/questions`}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors mx-2 rounded-xl"
                onClick={() => toggleOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                  <span className="text-xs font-bold">Q</span>
                </div>
                Manage Questions
              </Link>

              {/* Divider */}
              <div className="border-t border-white/10 my-2 mx-4" />

              {/* Delete Game */}
              <div className="mx-2">
                <DeleteGameButton
                  gameId={game.id}
                  gameTitle={game.title}
                  onSuccess={() => toggleOpen(false)}
                  variant="dropdown"
                />
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
