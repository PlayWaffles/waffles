"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    getTemplatesAction,
    assignToGameAction,
    TemplateListResult,
} from "@/actions/admin/question-templates";
import {
    XMarkIcon,
    MagnifyingGlassIcon,
    CheckIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import type { Difficulty, GameTheme } from "@/types/game";
import { THEME_LABELS, DIFFICULTY_STYLES } from "@/types/game";

interface QuestionPickerProps {
    gameId: string;
    existingTemplateIds?: string[];
    isOpen: boolean;
    onClose: () => void;
}

export function QuestionPicker({
    gameId,
    existingTemplateIds = [],
    isOpen,
    onClose,
}: QuestionPickerProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isAssigning, setIsAssigning] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTheme, setSelectedTheme] = useState<GameTheme | "">("");
    const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | "">("");
    const [templates, setTemplates] = useState<TemplateListResult["templates"]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    // Fetch templates when filters change
    useEffect(() => {
        if (!isOpen) return;

        startTransition(async () => {
            const result = await getTemplatesAction({
                search: searchQuery || undefined,
                theme: selectedTheme || undefined,
                difficulty: selectedDifficulty || undefined,
                limit: 50,
            });
            setTemplates(result.templates);
        });
    }, [isOpen, searchQuery, selectedTheme, selectedDifficulty]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set());
            setError(null);
        }
    }, [isOpen]);

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleAssign = async () => {
        if (selectedIds.size === 0) return;

        setIsAssigning(true);
        setError(null);

        try {
            const result = await assignToGameAction(gameId, Array.from(selectedIds));

            if (result.success) {
                router.refresh();
                onClose();
            } else {
                setError(result.error);
            }
        } catch (e) {
            setError("Failed to assign questions");
        } finally {
            setIsAssigning(false);
        }
    };

    if (!isOpen) return null;

    const existingSet = new Set(existingTemplateIds);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-3xl max-h-[80vh] bg-[#0a0a0b] border border-white/10 rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white font-display">
                            Add from Question Bank
                        </h2>
                        <p className="text-sm text-white/50">
                            {selectedIds.size > 0
                                ? `${selectedIds.size} selected`
                                : "Select questions to add"}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 p-4 border-b border-white/10">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search questions..."
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                        />
                    </div>
                    <select
                        value={selectedTheme}
                        onChange={(e) => setSelectedTheme(e.target.value as GameTheme | "")}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                        <option value="" className="bg-[#0a0a0b]">All Themes</option>
                        {Object.entries(THEME_LABELS).map(([value, { emoji, label }]) => (
                            <option key={value} value={value} className="bg-[#0a0a0b]">
                                {emoji} {label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedDifficulty}
                        onChange={(e) => setSelectedDifficulty(e.target.value as Difficulty | "")}
                        className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                    >
                        <option value="" className="bg-[#0a0a0b]">All Levels</option>
                        <option value="EASY" className="bg-[#0a0a0b]">Easy</option>
                        <option value="MEDIUM" className="bg-[#0a0a0b]">Medium</option>
                        <option value="HARD" className="bg-[#0a0a0b]">Hard</option>
                    </select>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isPending ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 border-2 border-[#FFC931]/30 border-t-[#FFC931] rounded-full animate-spin" />
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-white/50">No questions found</p>
                        </div>
                    ) : (
                        templates.map((template) => {
                            const isExisting = existingSet.has(template.id);
                            const isSelected = selectedIds.has(template.id);
                            const diffStyle = DIFFICULTY_STYLES[template.difficulty];

                            return (
                                <button
                                    key={template.id}
                                    onClick={() => !isExisting && toggleSelect(template.id)}
                                    disabled={isExisting}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${isExisting
                                        ? "bg-white/5 opacity-50 cursor-not-allowed"
                                        : isSelected
                                            ? "bg-[#FFC931]/20 border-2 border-[#FFC931]"
                                            : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <div
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${isExisting
                                            ? "border-white/20 bg-white/10"
                                            : isSelected
                                                ? "border-[#FFC931] bg-[#FFC931]"
                                                : "border-white/30"
                                            }`}
                                    >
                                        {isExisting ? (
                                            <CheckCircleIcon className="h-3 w-3 text-white/40" />
                                        ) : isSelected ? (
                                            <CheckIcon className="h-3 w-3 text-black" />
                                        ) : null}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm truncate">{template.content}</p>
                                        <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                                            <span className={`px-1.5 py-0.5 rounded ${diffStyle.bg} ${diffStyle.text}`}>
                                                {template.difficulty}
                                            </span>
                                            <span>{template.durationSec}s</span>
                                            <span>Used {template.usageCount}×</span>
                                        </div>
                                    </div>

                                    {/* Already in game badge */}
                                    {isExisting && (
                                        <span className="text-xs text-white/40 bg-white/10 px-2 py-1 rounded">
                                            Already added
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10">
                    {error && (
                        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 bg-white/5 text-white/60 font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAssign}
                            disabled={selectedIds.size === 0 || isAssigning}
                            className="flex-1 px-4 py-2.5 bg-[#FFC931] text-black font-bold rounded-xl hover:bg-[#FFD966] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isAssigning
                                ? "Adding..."
                                : `Add ${selectedIds.size} Question${selectedIds.size !== 1 ? "s" : ""}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
