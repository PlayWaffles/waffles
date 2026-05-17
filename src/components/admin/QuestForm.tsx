"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuestAction, updateQuestAction, type CreateQuestInput, type UpdateQuestInput } from "@/actions/admin/quests";
import { notify } from "@/components/ui/Toaster";

interface QuestFormProps {
    quest?: {
        id: string;
        slug: string;
        title: string;
        description: string;
        iconUrl: string | null;
        category: string;
        sortOrder: number;
        points: number;
        type: string;
        actionUrl: string | null;
        castHash: string | null;
        targetFid: number | null;
        requiredCount: number;
        isActive: boolean;
        startsAt: Date | null;
        endsAt: Date | null;
        repeatFrequency: string;
    };
}

const QUEST_TYPES = [
    { value: "LINK", label: "Link (Open URL)" },
    { value: "FARCASTER_FOLLOW", label: "Farcaster Follow" },
    { value: "FARCASTER_CAST", label: "Farcaster Cast" },
    { value: "FARCASTER_RECAST", label: "Farcaster Recast" },
    { value: "REFERRAL", label: "Referral" },
    { value: "CUSTOM", label: "Custom (Manual Approval)" },
];

const QUEST_CATEGORIES = [
    { value: "SOCIAL", label: "Social" },
    { value: "ONBOARDING", label: "Onboarding" },
    { value: "REFERRAL", label: "Referral" },
    { value: "ENGAGEMENT", label: "Engagement" },
    { value: "SPECIAL", label: "Special Event" },
];

const REPEAT_FREQUENCIES = [
    { value: "ONCE", label: "One-time Only" },
    { value: "DAILY", label: "Daily" },
    { value: "WEEKLY", label: "Weekly" },
    { value: "UNLIMITED", label: "Unlimited" },
];

export function QuestForm({ quest }: QuestFormProps) {
    const router = useRouter();
    const isEditing = !!quest;

    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        slug: quest?.slug || "",
        title: quest?.title || "",
        description: quest?.description || "",
        iconUrl: quest?.iconUrl || "",
        category: quest?.category || "SOCIAL",
        sortOrder: quest?.sortOrder || 0,
        points: quest?.points || 0,
        type: quest?.type || "LINK",
        actionUrl: quest?.actionUrl || "",
        castHash: quest?.castHash || "",
        targetFid: quest?.targetFid || null,
        requiredCount: quest?.requiredCount || 1,
        isActive: quest?.isActive ?? true,
        repeatFrequency: quest?.repeatFrequency || "ONCE",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const input = {
                slug: formData.slug,
                title: formData.title,
                description: formData.description,
                iconUrl: formData.iconUrl || null,
                category: formData.category as any,
                sortOrder: formData.sortOrder,
                points: formData.points,
                type: formData.type as any,
                actionUrl: formData.actionUrl || null,
                castHash: formData.castHash || null,
                targetFid: formData.targetFid,
                requiredCount: formData.requiredCount,
                isActive: formData.isActive,
                repeatFrequency: formData.repeatFrequency as any,
            };

            let result;
            if (isEditing) {
                result = await updateQuestAction({ id: quest!.id, ...input } as UpdateQuestInput);
            } else {
                result = await createQuestAction(input as CreateQuestInput);
            }

            if (result.success) {
                notify.success(isEditing ? "Quest updated!" : "Quest created!");
                router.push("/admin/quests");
                router.refresh();
            } else {
                notify.error(result.error);
            }
        } catch (error) {
            notify.error("Something went wrong");
        } finally {
            setIsLoading(false);
        }
    };

    const generateSlug = () => {
        const slug = formData.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
        setFormData({ ...formData, slug });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="bg-gradient-to-br from-white/6 to-white/2 rounded-2xl border border-white/8 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white font-display">Basic Information</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/50 mb-1">Title *</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            onBlur={() => !formData.slug && generateSlug()}
                            className="w-full px-4 py-2.5 bg-white/3 border border-white/10 rounded-xl text-white focus:border-[#14B985]/50 focus:ring-2 focus:ring-[#14B985]/10 focus:outline-none transition-all"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/50 mb-1">Slug *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                className="flex-1 px-4 py-2.5 bg-white/3 border border-white/10 rounded-xl text-white focus:border-[#14B985]/50 focus:ring-2 focus:ring-[#14B985]/10 focus:outline-none font-mono text-sm transition-all"
                                pattern="^[a-z0-9-]+$"
                                required
                            />
                            <button
                                type="button"
                                onClick={generateSlug}
                                className="px-4 py-2.5 text-sm bg-white/5 text-white/60 rounded-xl hover:bg-white/10 hover:text-white border border-white/8 transition-all"
                            >
                                Generate
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-white/50 mb-1">Description *</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-white/3 border border-white/10 rounded-xl text-white focus:border-[#14B985]/50 focus:ring-2 focus:ring-[#14B985]/10 focus:outline-none resize-none transition-all"
                        required
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Category *</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        >
                            {QUEST_CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Points *</label>
                        <input
                            type="number"
                            value={formData.points}
                            onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                            min={0}
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Sort Order</label>
                        <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#99A0AE] mb-1">Icon URL</label>
                    <input
                        type="url"
                        value={formData.iconUrl}
                        onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                        placeholder="/images/icons/quest.webp"
                        className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                    />
                </div>
            </div>

            {/* Quest Type & Action */}
            <div className="bg-gradient-to-br from-white/6 to-white/2 rounded-2xl border border-white/8 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white font-display">Quest Type & Action</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Type *</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        >
                            {QUEST_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Repeat Frequency</label>
                        <select
                            value={formData.repeatFrequency}
                            onChange={(e) => setFormData({ ...formData, repeatFrequency: e.target.value })}
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        >
                            {REPEAT_FREQUENCIES.map((freq) => (
                                <option key={freq.value} value={freq.value}>{freq.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Conditional fields based on type */}
                {(formData.type === "LINK" || formData.type === "FARCASTER_FOLLOW") && (
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Action URL</label>
                        <input
                            type="url"
                            value={formData.actionUrl}
                            onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        />
                    </div>
                )}

                {formData.type === "FARCASTER_RECAST" && (
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Cast Hash</label>
                        <input
                            type="text"
                            value={formData.castHash}
                            onChange={(e) => setFormData({ ...formData, castHash: e.target.value })}
                            placeholder="0x..."
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none font-mono"
                        />
                    </div>
                )}

                {(formData.type === "FARCASTER_FOLLOW" || formData.type === "FARCASTER_CAST") && (
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Target FID (for verification)</label>
                        <input
                            type="number"
                            value={formData.targetFid || ""}
                            onChange={(e) => setFormData({ ...formData, targetFid: parseInt(e.target.value) || null })}
                            placeholder="FID to verify follow/mention"
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        />
                    </div>
                )}

                {formData.type === "REFERRAL" && (
                    <div>
                        <label className="block text-sm font-medium text-[#99A0AE] mb-1">Required Referrals</label>
                        <input
                            type="number"
                            value={formData.requiredCount}
                            onChange={(e) => setFormData({ ...formData, requiredCount: parseInt(e.target.value) || 1 })}
                            min={1}
                            className="w-full px-3 py-2 bg-[#0D0F11] border border-white/10 rounded-lg text-white focus:border-[#14B985] focus:outline-none"
                        />
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="bg-gradient-to-br from-white/6 to-white/2 rounded-2xl border border-white/8 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white font-display">Status</h2>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-5 h-5 rounded border-white/10 bg-[#0D0F11] text-[#14B985] focus:ring-[#14B985]"
                    />
                    <span className="text-white">Quest is active and visible to users</span>
                </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/8 hover:border-white/15 transition-all"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-[#14B985] hover:bg-[#1BF5B0] text-black font-bold rounded-xl shadow-lg shadow-[#14B985]/20 transition-all disabled:opacity-50"
                >
                    {isLoading ? "Saving..." : isEditing ? "Update Quest" : "Create Quest"}
                </button>
            </div>
        </form>
    );
}
