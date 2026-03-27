"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { deleteTemplateAction } from "@/actions/admin/question-templates";
import {
    TrashIcon,
    PencilIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    MusicalNoteIcon,
    PhotoIcon,
} from "@heroicons/react/24/outline";
import type { Difficulty, GameTheme } from "@/types/game";

interface QuestionTemplate {
    id: string;
    content: string;
    options: string[];
    correctIndex: number;
    durationSec: number;
    theme: GameTheme;
    difficulty: Difficulty;
    usageCount: number;
    mediaUrl: string | null;
    soundUrl: string | null;
    createdAt: Date;
}

interface QuestionBankListProps {
    templates: QuestionTemplate[];
}

const THEME_LABELS: Record<GameTheme, { emoji: string; label: string }> = {
    FOOTBALL: { emoji: "⚽", label: "Football" },
    MOVIES: { emoji: "🎬", label: "Movies" },
    ANIME: { emoji: "🎌", label: "Anime" },
    POLITICS: { emoji: "🏛️", label: "Politics" },
    CRYPTO: { emoji: "₿", label: "Crypto" },
    GENERAL: { emoji: "🌐", label: "General" },
};

const DIFFICULTY_STYLES: Record<Difficulty, { bg: string; text: string }> = {
    EASY: { bg: "bg-green-500/20", text: "text-green-400" },
    MEDIUM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
    HARD: { bg: "bg-red-500/20", text: "text-red-400" },
};

function TemplateCard({ template }: { template: QuestionTemplate }) {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const correctLetter = String.fromCharCode(65 + template.correctIndex);
    const themeInfo = THEME_LABELS[template.theme];
    const diffStyle = DIFFICULTY_STYLES[template.difficulty];

    const handleDelete = async () => {
        if (!confirm(`Delete this question? It has been used in ${template.usageCount} games.`)) {
            return;
        }

        setIsDeleting(true);
        const result = await deleteTemplateAction(template.id);
        if (result.success) {
            router.refresh();
        } else {
            alert(result.error);
            setIsDeleting(false);
        }
    };

    return (
        <div className="group border-b border-white/5 last:border-b-0">
            {/* Main Row */}
            <div className="flex items-center gap-3 p-4 hover:bg-white/5 transition-colors">
                {/* Expand Toggle */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 text-white/30 hover:text-white transition-colors"
                >
                    {isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4" />
                    ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                    )}
                </button>

                {/* Theme Badge */}
                <div
                    className="w-10 h-10 rounded-lg bg-[#FFC931]/10 flex items-center justify-center text-lg shrink-0"
                    title={themeInfo.label}
                >
                    {themeInfo.emoji}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{template.content}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span className={`px-1.5 py-0.5 rounded ${diffStyle.bg} ${diffStyle.text}`}>
                            {template.difficulty}
                        </span>
                        <span className="flex items-center gap-1">
                            <CheckCircleIcon className="h-3 w-3 text-[#14B985]" />
                            {correctLetter}
                        </span>
                        <span>{template.durationSec}s</span>
                        {template.mediaUrl && <PhotoIcon className="h-3 w-3 text-[#00CFF2]" />}
                        {template.soundUrl && <MusicalNoteIcon className="h-3 w-3 text-[#FB72FF]" />}
                    </div>
                </div>

                {/* Usage Count */}
                <div className="text-center px-3">
                    <div className="text-lg font-bold text-white">{template.usageCount}</div>
                    <div className="text-[10px] text-white/30 uppercase tracking-wide">uses</div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                        href={`/admin/questions/${template.id}/edit`}
                        className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <PencilIcon className="h-4 w-4" />
                    </Link>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 pl-14 space-y-3">
                    {/* Options Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {template.options.map((opt, idx) => (
                            <div
                                key={idx}
                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${idx === template.correctIndex
                                    ? "bg-[#14B985]/20 border border-[#14B985]/30 text-[#14B985]"
                                    : "bg-white/5 border border-white/10 text-white/60"
                                    }`}
                            >
                                <span className="font-bold text-white/30">
                                    {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="truncate">{opt}</span>
                                {idx === template.correctIndex && (
                                    <CheckCircleIcon className="h-4 w-4 ml-auto shrink-0" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Media Preview */}
                    {(template.mediaUrl || template.soundUrl) && (
                        <div className="flex gap-3 pt-2 border-t border-white/10">
                            {template.mediaUrl && (
                                <div className="relative h-16 w-24 rounded-lg overflow-hidden border border-white/10">
                                    <Image
                                        src={template.mediaUrl}
                                        alt="Question media"
                                        fill
                                        className="object-cover"
                                        sizes="96px"
                                    />
                                </div>
                            )}
                            {template.soundUrl && (
                                <audio controls className="h-10">
                                    <source src={template.soundUrl} />
                                </audio>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function QuestionBankList({ templates }: QuestionBankListProps) {
    return (
        <div>
            {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
            ))}
        </div>
    );
}
