"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
    MegaphoneIcon,
    PaperAirplaneIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    SparklesIcon,
} from "@heroicons/react/24/outline";
import {
    createAnnouncementAction,
    AnnouncementResult,
} from "@/actions/admin/announcements";

const TITLE_MAX = 140;
const BODY_MAX = 1000;

const TONES = [
    { value: "leaf", label: "Leaf (cyan)", dot: "#00CFF2" },
    { value: "maple", label: "Maple (gold)", dot: "#FFC931" },
    { value: "berry", label: "Berry (pink)", dot: "#FB72FF" },
] as const;

// The announcement's category — what tapping it does. Blank = the disappearing
// toast (no popup). "open:*" reveal the details as a modal (no button label
// needed); "screen:"/"theme:" are nav buttons (need a label). Every announcement
// shows as the transient toast on delivery and is logged in the bell inbox.
const CTA_TARGETS = [
    { value: "", label: "Disappearing toast — no popup (default)" },
    { value: "open:small", label: "Tap opens — small modal" },
    { value: "open:full", label: "Tap opens — full screen" },
    { value: "screen:home", label: "Button → Home (play)" },
    { value: "screen:compete", label: "Button → Compete" },
    { value: "screen:leaderboard", label: "Button → Leaderboard" },
    { value: "screen:levels", label: "Button → Levels" },
    { value: "screen:profile", label: "Button → Profile / Prize Wallet" },
    { value: "screen:shop", label: "Button → Shop" },
    { value: "theme:world-cup", label: "Button → World Cup takeover" },
] as const;

const TONE_ACCENT: Record<string, string> = { leaf: "#00CFF2", maple: "#FFC931", berry: "#FB72FF" };

export function AnnouncementForm() {
    const [state, formAction] = useActionState<AnnouncementResult | null, FormData>(
        createAnnouncementAction,
        null,
    );
    const [isPending, startTransition] = useTransition();

    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [emoji, setEmoji] = useState("📣");
    const [tone, setTone] = useState<string>("leaf");
    const [ctaLabel, setCtaLabel] = useState("");
    const [ctaTarget, setCtaTarget] = useState("");

    useEffect(() => {
        if (state?.success) {
            setTitle("");
            setBody("");
            setEmoji("📣");
            setTone("leaf");
            setCtaLabel("");
            setCtaTarget("");
        }
    }, [state]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
    };

    const accent = TONE_ACCENT[tone] ?? "#00CFF2";

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {state?.success && (
                <div className="p-4 bg-[#14B985]/10 border border-[#14B985]/30 rounded-2xl flex items-center gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-[#14B985] shrink-0" />
                    <p className="text-sm font-medium text-[#14B985]">Announcement published — live in players&apos; banner & inbox.</p>
                </div>
            )}
            {state && !state.success && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-400 shrink-0" />
                    <p className="text-sm font-medium text-red-400">{state.error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Compose */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-linear-to-br from-[#FFC931]/5 to-transparent rounded-2xl border border-white/10 p-6 space-y-4">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2.5 rounded-xl bg-[#FFC931]/15">
                                <MegaphoneIcon className="h-5 w-5 text-[#FFC931]" />
                            </div>
                            <h3 className="font-bold text-white font-display">Message</h3>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-24 shrink-0">
                                <label htmlFor="emoji" className="block text-sm font-medium text-white/70 mb-2">Emoji</label>
                                <input id="emoji" name="emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} required
                                    className="w-full px-3 py-3.5 bg-transparent border border-white/10 rounded-xl text-white text-2xl text-center focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all" />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="title" className="block text-sm font-medium text-white/70 mb-2">Title</label>
                                <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required
                                    placeholder="Double XP weekend"
                                    className="w-full px-4 py-3.5 bg-transparent border border-white/10 rounded-xl text-white text-lg placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all font-medium" />
                                <p className={`text-xs mt-2 text-right ${title.length >= TITLE_MAX ? "text-red-400" : "text-white/40"}`}>{title.length}/{TITLE_MAX}</p>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="body" className="block text-sm font-medium text-white/70 mb-2">Body</label>
                            <textarea id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={BODY_MAX} rows={3} required
                                placeholder="Every tournament you play this weekend earns 2× XP."
                                className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all resize-none" />
                            <p className={`text-xs mt-2 text-right ${body.length >= BODY_MAX ? "text-red-400" : "text-white/40"}`}>{body.length}/{BODY_MAX}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="tone" className="block text-sm font-medium text-white/70 mb-2">Tone</label>
                                <select id="tone" name="tone" value={tone} onChange={(e) => setTone(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#1C1C1E] border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all">
                                    {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="sortOrder" className="block text-sm font-medium text-white/70 mb-2">Priority (higher = first)</label>
                                <input id="sortOrder" name="sortOrder" type="number" min={0} max={1000} defaultValue={10}
                                    className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all" />
                            </div>
                        </div>
                    </section>

                    <section className="bg-linear-to-br from-[#00CFF2]/5 to-transparent rounded-2xl border border-white/10 p-6 space-y-4">
                        <h3 className="font-bold text-white font-display">Call to action <span className="text-white/40 font-normal text-sm">(optional)</span></h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="ctaLabel" className="block text-sm font-medium text-white/70 mb-2">Button label</label>
                                <input id="ctaLabel" name="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={60}
                                    placeholder="Play now"
                                    className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-white placeholder-white/30 focus:ring-2 focus:ring-[#00CFF2]/50 focus:border-[#00CFF2] transition-all" />
                            </div>
                            <div>
                                <label htmlFor="ctaTarget" className="block text-sm font-medium text-white/70 mb-2">Goes to</label>
                                <select id="ctaTarget" name="ctaTarget" value={ctaTarget} onChange={(e) => setCtaTarget(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#1C1C1E] border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#00CFF2]/50 focus:border-[#00CFF2] transition-all">
                                    {CTA_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="bg-linear-to-br from-white/5 to-transparent rounded-2xl border border-white/10 p-6">
                        <h3 className="font-bold text-white font-display mb-4">Schedule <span className="text-white/40 font-normal text-sm">(optional — leave blank to run immediately & indefinitely)</span></h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="startsAt" className="block text-sm font-medium text-white/70 mb-2">Starts</label>
                                <input id="startsAt" name="startsAt" type="datetime-local"
                                    className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all [color-scheme:dark]" />
                            </div>
                            <div>
                                <label htmlFor="endsAt" className="block text-sm font-medium text-white/70 mb-2">Ends</label>
                                <input id="endsAt" name="endsAt" type="datetime-local"
                                    className="w-full px-4 py-3 bg-transparent border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[#FFC931]/50 focus:border-[#FFC931] transition-all [color-scheme:dark]" />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Preview + publish */}
                <div className="space-y-6">
                    <section className="bg-linear-to-br from-[#FB72FF]/5 to-transparent rounded-2xl border border-white/10 p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2.5 rounded-xl bg-[#FB72FF]/15"><SparklesIcon className="h-5 w-5 text-[#FB72FF]" /></div>
                            <h3 className="font-bold text-white font-display">In-app preview</h3>
                        </div>
                        <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: `${accent}1f`, border: `1px solid ${accent}55` }}>
                            <span className="text-2xl shrink-0">{emoji || "📣"}</span>
                            <div className="min-w-0">
                                <p className="font-display text-white text-sm leading-tight truncate">{title || "Announcement title"}</p>
                                <p className="text-white/60 text-xs mt-0.5 truncate">{ctaLabel ? `${ctaLabel} ›` : (body || "Your message here…")}</p>
                            </div>
                        </div>
                    </section>

                    <button type="submit" disabled={isPending || !title.trim() || !body.trim()}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-linear-to-r from-[#FFC931] to-[#FF9500] text-black rounded-2xl font-bold text-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,201,49,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
                        {isPending ? (
                            <><div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Publishing…</>
                        ) : (
                            <><PaperAirplaneIcon className="h-5 w-5" />Publish announcement</>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}

export default AnnouncementForm;
