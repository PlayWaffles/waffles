"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { TemplateActionResult } from "@/actions/admin/question-templates";
import type { Difficulty, GameTheme } from "@/types/game";

interface QuestionTemplateFormProps {
    action: (
        prevState: TemplateActionResult | null,
        formData: FormData
    ) => Promise<TemplateActionResult>;
    defaultValues?: {
        content?: string;
        options?: string[];
        correctIndex?: number;
        durationSec?: number;
        theme?: GameTheme;
        difficulty?: Difficulty;
        mediaUrl?: string | null;
        soundUrl?: string | null;
    };
    submitLabel?: string;
    redirectOnSuccess?: string;
}

const THEMES: { value: GameTheme; label: string; emoji: string }[] = [
    { value: "FOOTBALL", label: "Football", emoji: "⚽" },
    { value: "MOVIES", label: "Movies", emoji: "🎬" },
    { value: "ANIME", label: "Anime", emoji: "🎌" },
    { value: "POLITICS", label: "Politics", emoji: "🏛️" },
    { value: "CRYPTO", label: "Crypto", emoji: "₿" },
    { value: "GENERAL", label: "General", emoji: "🌐" },
];

const DIFFICULTIES: { value: Difficulty; label: string; color: string }[] = [
    { value: "EASY", label: "Easy", color: "text-green-400" },
    { value: "MEDIUM", label: "Medium", color: "text-yellow-400" },
    { value: "HARD", label: "Hard", color: "text-red-400" },
];

export function QuestionTemplateForm({
    action,
    defaultValues = {},
    submitLabel = "Save Question",
    redirectOnSuccess = "/admin/questions",
}: QuestionTemplateFormProps) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [resetKey, setResetKey] = useState(0);
    const [mediaUrl, setMediaUrl] = useState(defaultValues.mediaUrl || "");
    const [soundUrl, setSoundUrl] = useState(defaultValues.soundUrl || "");

    const [state, formAction] = useActionState<TemplateActionResult | null, FormData>(
        action,
        null
    );

    // Handle success
    useEffect(() => {
        if (state?.success) {
            if (redirectOnSuccess) {
                router.push(redirectOnSuccess);
            } else {
                formRef.current?.reset();
                setResetKey((prev) => prev + 1);
                setMediaUrl("");
                setSoundUrl("");
            }
        }
    }, [state?.success, redirectOnSuccess, router]);

    const defaultCorrectLetter = defaultValues.correctIndex !== undefined
        ? String.fromCharCode(65 + defaultValues.correctIndex)
        : undefined;

    return (
        <form ref={formRef} action={formAction} className="space-y-6">
            <input type="hidden" name="mediaUrl" value={mediaUrl} />
            <input type="hidden" name="soundUrl" value={soundUrl} />

            {/* Question Content */}
            <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                    Question <span className="text-red-400">*</span>
                </label>
                <textarea
                    name="content"
                    required
                    rows={3}
                    defaultValue={defaultValues.content}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all resize-none"
                    placeholder="Enter your trivia question..."
                />
            </div>

            {/* Theme & Difficulty */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Theme <span className="text-red-400">*</span>
                    </label>
                    <select
                        name="theme"
                        required
                        defaultValue={defaultValues.theme || "GENERAL"}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                    >
                        {THEMES.map((theme) => (
                            <option key={theme.value} value={theme.value} className="bg-[#0a0a0b]">
                                {theme.emoji} {theme.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Difficulty <span className="text-red-400">*</span>
                    </label>
                    <select
                        name="difficulty"
                        required
                        defaultValue={defaultValues.difficulty || "MEDIUM"}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                    >
                        {DIFFICULTIES.map((diff) => (
                            <option key={diff.value} value={diff.value} className="bg-[#0a0a0b]">
                                {diff.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Media Pickers */}
            <div className="grid grid-cols-2 gap-4">
                <MediaPicker
                    key={`media-${resetKey}`}
                    label="Image (optional)"
                    name="mediaUrl"
                    accept="image"
                    selectedUrl={mediaUrl}
                    onSelect={setMediaUrl}
                />
                <MediaPicker
                    key={`sound-${resetKey}`}
                    label="Audio (optional)"
                    name="soundUrl"
                    accept="audio"
                    selectedUrl={soundUrl}
                    onSelect={setSoundUrl}
                />
            </div>

            {/* Answer Options */}
            <div>
                <label className="block text-sm font-medium text-white/70 mb-3">
                    Answer Options <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {["A", "B", "C", "D"].map((letter, idx) => (
                        <div key={letter}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/10 text-white/60">
                                    {letter}
                                </span>
                            </div>
                            <input
                                type="text"
                                name={`option${letter}`}
                                required
                                defaultValue={defaultValues.options?.[idx]}
                                placeholder={`Option ${letter}`}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Correct Answer & Duration */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Correct Answer <span className="text-red-400">*</span>
                    </label>
                    <select
                        name="correctAnswer"
                        required
                        defaultValue={defaultCorrectLetter}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                    >
                        <option value="" className="bg-[#0a0a0b]">
                            Select...
                        </option>
                        <option value="A" className="bg-[#0a0a0b]">A</option>
                        <option value="B" className="bg-[#0a0a0b]">B</option>
                        <option value="C" className="bg-[#0a0a0b]">C</option>
                        <option value="D" className="bg-[#0a0a0b]">D</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Duration <span className="text-white/30">(seconds)</span>
                    </label>
                    <input
                        type="number"
                        name="durationSec"
                        defaultValue={defaultValues.durationSec || 10}
                        min={5}
                        max={60}
                        className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all"
                    />
                </div>
            </div>

            {/* Error Message */}
            {state && !state.success && (
                <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm">{state.error}</p>
                </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex-1 px-6 py-3 bg-white/5 text-white/60 font-medium rounded-xl hover:bg-white/10 hover:text-white transition-all"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-[#FFC931] text-black font-bold rounded-xl hover:bg-[#FFD966] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[#FFC931] transition-all"
                >
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}
