import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
    PencilIcon,
    QuestionMarkCircleIcon,
    CalendarIcon,
    ClockIcon,
    UserGroupIcon,
    CurrencyDollarIcon,
    TicketIcon,
} from "@heroicons/react/24/outline";
import { getGamePhase } from "@/lib/types";
import { SponsorGameCard } from "@/components/admin/SponsorGameCard";
import { RoundupButton } from "@/components/admin/RoundupButton";
import { formatAdminGameLabel } from "@/lib/game/labels";
import { TicketPurchaseSource } from "@prisma";

// ============================================
// HELPER COMPONENTS
// ============================================

function StatCard({
    icon: Icon,
    label,
    value,
    color = "white",
    subtext,
}: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    color?: "white" | "gold" | "green" | "blue" | "pink";
    subtext?: string;
}) {
    const colors = {
        white: "text-white",
        gold: "text-[#FFC931]",
        green: "text-[#14B985]",
        blue: "text-[#00CFF2]",
        pink: "text-[#FB72FF]",
    };

    const iconBg = {
        white: "bg-white/10",
        gold: "bg-[#FFC931]/10",
        green: "bg-[#14B985]/10",
        blue: "bg-[#00CFF2]/10",
        pink: "bg-[#FB72FF]/10",
    };

    return (
        <div className="group relative overflow-hidden bg-linear-to-br from-white/6 to-white/2 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all duration-300">
            {/* Subtle glow on hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${iconBg[color]} blur-3xl`} />

            <div className="relative flex items-start gap-4">
                <div className={`p-2.5 rounded-xl ${iconBg[color]}`}>
                    <Icon className={`h-5 w-5 ${colors[color]}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-1">
                        {label}
                    </p>
                    <p className={`text-2xl font-bold ${colors[color]} font-display tracking-tight`}>
                        {value}
                    </p>
                    {subtext && (
                        <p className="text-white/40 text-xs mt-0.5">{subtext}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ phase }: { phase: string }) {
    const config = {
        SCHEDULED: {
            bg: "bg-gradient-to-r from-[#FFC931]/20 to-[#FFC931]/10",
            border: "border-[#FFC931]/30",
            text: "text-[#FFC931]",
            dot: "bg-[#FFC931]",
            label: "Scheduled",
        },
        LIVE: {
            bg: "bg-gradient-to-r from-[#14B985]/20 to-[#14B985]/10",
            border: "border-[#14B985]/30",
            text: "text-[#14B985]",
            dot: "bg-[#14B985] animate-pulse",
            label: "Live Now",
        },
        ENDED: {
            bg: "bg-gradient-to-r from-white/10 to-white/5",
            border: "border-white/20",
            text: "text-white/70",
            dot: "bg-white/50",
            label: "Ended",
        },
    };

    const c = config[phase as keyof typeof config] || config.ENDED;

    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${c.bg} ${c.border} ${c.text} border`}>
            <span className={`w-2 h-2 rounded-full ${c.dot}`} />
            {c.label}
        </span>
    );
}

// ============================================
// MAIN PAGE
// ============================================

export default async function GameDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const game = await prisma.game.findUnique({
        where: { id },
        select: {
            id: true,
            onchainId: true,
            platform: true,
            title: true,
            description: true,
            theme: true,
            coverUrl: true,
            startsAt: true,
            endsAt: true,
            tierPrices: true,
            prizePool: true,
            playerCount: true,
            maxPlayers: true,
            roundBreakSec: true,
            rankedAt: true,
            onChainAt: true,
            _count: {
                select: {
                    questions: true,
                    entries: true,
                },
            },
            entries: {
                orderBy: { score: "desc" },
                take: 20,
                select: {
                    paidAt: true,
                    purchaseSource: true,
                    score: true,
                    rank: true,
                    prize: true,
                    claimedAt: true,
                    user: {
                        select: { username: true, pfpUrl: true, wallet: true },
                    },
                },
            },
        },
    });

    if (!game) {
        notFound();
    }

    const phase = getGamePhase(game);

    // Format dates
    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date);
    };

    const duration = Math.round((game.endsAt.getTime() - game.startsAt.getTime()) / (1000 * 60));
    const paidEntriesCount = game.entries.filter((entry) => entry.paidAt).length;
    const freePlayerEntriesCount = game.entries.filter(
        (entry) => entry.purchaseSource === TicketPurchaseSource.FREE_PLAYER,
    ).length;
    const freeAdminEntriesCount = game.entries.filter(
        (entry) => entry.purchaseSource === TicketPurchaseSource.FREE_ADMIN,
    ).length;
    const freeEntriesCount = freePlayerEntriesCount + freeAdminEntriesCount;

    return (
        <div className="space-y-8 max-w-6xl">
            {/* Breadcrumb & Actions Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/games"
                        className="flex items-center gap-1.5 text-white/40 hover:text-white transition-colors text-sm"
                    >
                        <span>←</span>
                        <span>Games</span>
                    </Link>
                    <span className="text-white/20">/</span>
                    <span className="text-white/60 text-sm truncate max-w-[280px]">
                        {formatAdminGameLabel(game.title, game.platform)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {phase === "ENDED" && (
                        <RoundupButton gameId={game.id} />
                    )}
                    <Link
                        href={`/admin/games/${game.id}/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all text-sm font-medium border border-white/8 hover:border-white/15"
                    >
                        <PencilIcon className="h-4 w-4" />
                        Edit
                    </Link>
                    <Link
                        href={`/admin/games/${game.id}/questions`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFC931] hover:bg-[#FFD966] text-black rounded-xl transition-all text-sm font-bold shadow-lg shadow-[#FFC931]/20 hover:shadow-[#FFC931]/30"
                    >
                        <QuestionMarkCircleIcon className="h-4 w-4" />
                        Questions
                    </Link>
                </div>
            </div>

            {/* Hero Section */}
            <div className="relative overflow-hidden bg-linear-to-br from-white/6 to-transparent border border-white/8 rounded-3xl p-6 sm:p-8">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-[#FFC931]/10 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <StatusBadge phase={phase} />
                            {phase === "ENDED" && game.rankedAt && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[#14B985]/10 border border-[#14B985]/30 text-[#14B985]">
                                    <span className="w-2 h-2 rounded-full bg-[#14B985]" />
                                    Ranked
                                </span>
                            )}
                            {phase === "ENDED" && game.onChainAt && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[#00CFF2]/10 border border-[#00CFF2]/30 text-[#00CFF2]">
                                    <span className="w-2 h-2 rounded-full bg-[#00CFF2]" />
                                    On-Chain
                                </span>
                            )}
                            {phase === "ENDED" && !game.rankedAt && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-red-500/10 border border-red-500/30 text-red-400">
                                    <span className="w-2 h-2 rounded-full bg-red-400" />
                                    Not Ranked
                                </span>
                            )}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-white font-display tracking-tight">
                            {formatAdminGameLabel(game.title, game.platform)}
                        </h1>
                        {game.description && (
                            <p className="text-white/50 text-sm max-w-lg leading-relaxed">
                                {game.description}
                            </p>
                        )}

                        {/* Time Info */}
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 text-white/40">
                                <CalendarIcon className="h-4 w-4" />
                                <span>{formatDate(game.startsAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/40">
                                <ClockIcon className="h-4 w-4" />
                                <span>{duration} min</span>
                            </div>
                            {game.theme && (
                                <span className="px-2 py-0.5 bg-white/10 rounded-md text-white/50 text-xs">
                                    {game.theme}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Cover Image */}
                    {game.coverUrl && (
                        <div className="shrink-0">
                            <img
                                src={game.coverUrl}
                                alt={game.title}
                                className="w-32 h-32 sm:w-40 sm:h-40 object-cover rounded-2xl border border-white/10 shadow-2xl"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={UserGroupIcon}
                    label="Players"
                    value={game.playerCount}
                    color="blue"
                    subtext={game.maxPlayers ? `of ${game.maxPlayers} max` : undefined}
                />
                <StatCard
                    icon={TicketIcon}
                    label="Ticket Mix"
                    value={`${paidEntriesCount} paid`}
                    color="gold"
                    subtext={
                        freeEntriesCount > 0
                            ? `${freePlayerEntriesCount} play-only, ${freeAdminEntriesCount} admin free`
                            : "No free tickets"
                    }
                />
                <StatCard
                    icon={QuestionMarkCircleIcon}
                    label="Questions"
                    value={game._count.questions}
                    color="pink"
                />
                <StatCard
                    icon={CurrencyDollarIcon}
                    label="Prize Pool"
                    value={`$${game.prizePool.toLocaleString()}`}
                    color="green"
                />
            </div>

            {/* Sponsor Prize Pool Card - Only show for on-chain games */}
            {game.onchainId && (
                <SponsorGameCard
                    gameId={game.id}
                    onchainId={game.onchainId as `0x${string}`}
                    gameTitle={game.title}
                    platform={game.platform}
                />
            )}

            {/* Players List */}
            <div className="bg-linear-to-br from-white/6 to-white/2 border border-white/8 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white font-display mb-2 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-[#FFC931]/10 flex items-center justify-center">
                        🏆
                    </span>
                    Players ({game._count.entries})
                </h2>
                <p className="text-sm text-white/45 mb-4">
                    Showing paid, play-only, and admin-issued free entrants.
                </p>

                {game.entries.length > 0 ? (
                    <div className="space-y-2">
                        {game.entries.map((entry, i) => {
                            const rank = entry.rank || i + 1;
                            const isWinner = (entry.prize || 0) > 0;
                            const hasClaimed = !!entry.claimedAt;
                            const ticketType =
                                entry.purchaseSource === TicketPurchaseSource.FREE_PLAYER
                                    ? {
                                        label: "Play Only",
                                        className: "bg-[#00CFF2]/15 text-[#00CFF2]",
                                    }
                                    : entry.purchaseSource === TicketPurchaseSource.FREE_ADMIN
                                        ? {
                                            label: "Admin Free",
                                            className: "bg-[#FFC931]/15 text-[#FFC931]",
                                        }
                                        : {
                                            label: "Paid",
                                            className: "bg-[#14B985]/15 text-[#14B985]",
                                        };

                            return (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Rank Badge */}
                                        <div
                                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rank === 1
                                                ? "bg-[#FFC931]/20 text-[#FFC931]"
                                                : rank === 2
                                                    ? "bg-[#C0C0C0]/20 text-[#C0C0C0]"
                                                    : rank === 3
                                                        ? "bg-[#CD7F32]/20 text-[#CD7F32]"
                                                        : "bg-white/10 text-white/60"
                                                }`}
                                        >
                                            {rank}
                                        </div>
                                        {/* Avatar */}
                                        {entry.user?.pfpUrl ? (
                                            <img
                                                src={entry.user.pfpUrl}
                                                alt=""
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white/60 text-sm font-medium">
                                                {entry.user?.username?.charAt(0)?.toUpperCase() || "?"}
                                            </div>
                                        )}
                                        {/* Username & Score */}
                                        <div>
                                            <p className="text-white font-medium text-sm">
                                                @{entry.user?.username || entry.user?.wallet?.slice(0, 8) || "Unknown"}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-white/50 text-xs">
                                                {entry.score} pts
                                                </p>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ticketType.className}`}>
                                                    {ticketType.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Prize & Claim Status */}
                                    <div className="text-right flex items-center gap-3">
                                        {isWinner && (
                                            <>
                                                <p className="text-[#14B985] font-bold">
                                                    ${(entry.prize || 0).toFixed(2)}
                                                </p>
                                                {hasClaimed ? (
                                                    <span className="px-2 py-1 bg-[#14B985]/20 text-[#14B985] text-xs rounded-full font-medium">
                                                        Claimed
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-[#FFC931]/20 text-[#FFC931] text-xs rounded-full font-medium">
                                                        Unclaimed
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                            <span className="text-3xl">📊</span>
                        </div>
                        <p className="text-white font-medium mb-1">No Entries</p>
                        <p className="text-white/50 text-sm">No player entries found for this game.</p>
                    </div>
                )}
            </div>

        </div>
    );
}
