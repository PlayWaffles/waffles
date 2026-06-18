"use client";

import { useTransition } from "react";
import { TrashIcon, PauseCircleIcon, PlayCircleIcon } from "@heroicons/react/24/outline";
import {
    setAnnouncementActiveAction,
    deleteAnnouncementAction,
} from "@/actions/admin/announcements";

const TONE_DOT: Record<string, string> = { leaf: "#00CFF2", maple: "#FFC931", berry: "#FB72FF" };

export type AdminAnnouncementRow = {
    id: string;
    emoji: string;
    title: string;
    body: string;
    tone: string;
    isActive: boolean;
    sortOrder: number;
    ctaLabel: string | null;
    startsAt: string | null;
    endsAt: string | null;
};

export function AnnouncementRow({ row }: { row: AdminAnnouncementRow }) {
    const [isPending, startTransition] = useTransition();

    const toggle = () => startTransition(async () => { await setAnnouncementActiveAction(row.id, !row.isActive); });
    const remove = () => {
        if (!confirm(`Delete "${row.title}"? This removes it for everyone.`)) return;
        startTransition(async () => { await deleteAnnouncementAction(row.id); });
    };

    return (
        <div className={`flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 transition-opacity ${isPending ? "opacity-50" : ""}`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                style={{ background: `${TONE_DOT[row.tone] ?? "#00CFF2"}22` }}>{row.emoji}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">{row.title}</p>
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: TONE_DOT[row.tone] ?? "#00CFF2" }} />
                    {!row.isActive && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/40 px-1.5 py-0.5 rounded bg-white/10">Paused</span>}
                </div>
                <p className="text-xs text-white/50 truncate mt-0.5">{row.body}</p>
                <p className="text-[11px] text-white/35 mt-1 flex items-center gap-2">
                    <span>priority {row.sortOrder}</span>
                    {row.ctaLabel && <><span>•</span><span>CTA: {row.ctaLabel}</span></>}
                    {(row.startsAt || row.endsAt) && <><span>•</span><span>{row.startsAt ?? "—"} → {row.endsAt ?? "∞"}</span></>}
                </p>
            </div>
            <button type="button" onClick={toggle} disabled={isPending} aria-label={row.isActive ? "Pause" : "Activate"}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:cursor-not-allowed">
                {row.isActive ? <PauseCircleIcon className="h-5 w-5" /> : <PlayCircleIcon className="h-5 w-5 text-[#14B985]" />}
            </button>
            <button type="button" onClick={remove} disabled={isPending} aria-label="Delete"
                className="p-2 rounded-lg hover:bg-red-500/15 text-white/60 hover:text-red-400 transition-colors disabled:cursor-not-allowed">
                <TrashIcon className="h-5 w-5" />
            </button>
        </div>
    );
}

export default AnnouncementRow;
