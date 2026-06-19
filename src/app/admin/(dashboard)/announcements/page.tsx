import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MegaphoneIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { StatsCard } from "@/components/admin/StatsCard";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { AnnouncementRow } from "@/components/admin/AnnouncementRow";

export const metadata: Metadata = {
    title: "Announcements | Waffles Admin",
    description: "Publish in-app announcements to the player banner & inbox",
};

const fmt = (d: Date | null) =>
    d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export default async function AnnouncementsPage() {
    const now = new Date();
    const rows = await prisma.announcement.findMany({
        where: { kind: { not: "migration" } },
        orderBy: [{ isActive: "desc" }, { sortOrder: "desc" }, { createdAt: "desc" }],
        select: {
            id: true, emoji: true, title: true, body: true, tone: true, isActive: true,
            sortOrder: true, ctaLabel: true, startsAt: true, endsAt: true,
        },
    });

    const liveCount = rows.filter(
        (r) => r.isActive && (!r.startsAt || r.startsAt <= now) && (!r.endsAt || r.endsAt >= now),
    ).length;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white font-display flex items-center gap-3">
                    <MegaphoneIcon className="h-7 w-7 text-[#FFC931]" />
                    Announcements
                </h1>
                <p className="text-white/60 mt-1">
                    In-app cards shown in the player Home banner & inbox. Publishes instantly — no app release.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard title="Live Now" value={liveCount.toString()} subtitle="Visible to players right now"
                    icon={<CheckCircleIcon className="h-6 w-6 text-[#14B985]" />} glowVariant="success" />
                <StatsCard title="Total" value={rows.length.toString()} subtitle="All announcements (incl. paused)"
                    icon={<MegaphoneIcon className="h-6 w-6 text-[#FFC931]" />} glowVariant="gold" />
                <StatsCard title="Scheduled" value={rows.filter((r) => r.startsAt && r.startsAt > now).length.toString()}
                    subtitle="Set to go live later" icon={<ClockIcon className="h-6 w-6 text-[#00CFF2]" />} glowVariant="cyan" />
            </div>

            <AnnouncementForm />

            <section className="bg-linear-to-br from-white/5 to-transparent rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2.5 rounded-xl bg-white/10"><MegaphoneIcon className="h-5 w-5 text-white/60" /></div>
                    <div>
                        <h3 className="font-bold text-white font-display">All announcements</h3>
                        <p className="text-sm text-white/50">Pause, re-activate, or delete</p>
                    </div>
                </div>
                {rows.length === 0 ? (
                    <p className="text-center text-sm text-white/40 py-8">No announcements yet — publish your first one above.</p>
                ) : (
                    <div className="space-y-3">
                        {rows.map((r) => (
                            <AnnouncementRow
                                key={r.id}
                                row={{
                                    id: r.id, emoji: r.emoji, title: r.title, body: r.body, tone: r.tone,
                                    isActive: r.isActive, sortOrder: r.sortOrder, ctaLabel: r.ctaLabel,
                                    startsAt: fmt(r.startsAt), endsAt: fmt(r.endsAt),
                                }}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
