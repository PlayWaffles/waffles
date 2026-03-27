import { prisma } from "@/lib/db";
import Link from "next/link";
import { TicketIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { GameFilter } from "./_components/GameFilter";
import { IssueFreeTicketCard } from "./_components/IssueFreeTicketCard";
import { TicketPurchaseSource } from "@prisma";

// ============================================
// DATA FETCHING
// ============================================

async function getTickets(searchParams: {
    page?: string;
    status?: string;
    game?: string;
    q?: string;
}) {
    const page = parseInt(searchParams.page || "1");
    const pageSize = 50;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    // Filter by ticket status
    if (searchParams.status === "paid") {
        where.paidAt = { not: null };
    } else if (searchParams.status === "free") {
        where.purchaseSource = TicketPurchaseSource.FREE_ADMIN;
    } else if (searchParams.status === "unpaid") {
        where.paidAt = null;
        where.purchaseSource = { not: TicketPurchaseSource.FREE_ADMIN };
    } else if (searchParams.status === "claimed") {
        where.claimedAt = { not: null };
    }

    // Filter by game
    if (searchParams.game) {
        where.gameId = searchParams.game;
    }

    // Search by username or tx hash
    if (searchParams.q) {
        where.OR = [
            { user: { username: { contains: searchParams.q, mode: "insensitive" } } },
            { txHash: { contains: searchParams.q, mode: "insensitive" } },
        ];
    }

    const [entries, total] = await Promise.all([
        prisma.gameEntry.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        pfpUrl: true,
                    },
                },
                game: {
                    select: {
                        id: true,
                        title: true,
                        theme: true,
                    },
                },
            },
        }),
        prisma.gameEntry.count({ where }),
    ]);

    return { entries, total, page, pageSize };
}

async function getStats() {
    const [totalEntries, paidEntries, freeEntries, claimedPrizes, games] = await Promise.all([
        prisma.gameEntry.count(),
        prisma.gameEntry.count({ where: { paidAt: { not: null } } }),
        prisma.gameEntry.count({ where: { purchaseSource: TicketPurchaseSource.FREE_ADMIN } }),
        prisma.gameEntry.count({ where: { claimedAt: { not: null } } }),
        prisma.game.findMany({
            orderBy: { startsAt: "desc" },
            take: 20,
            select: { id: true, title: true },
        }),
    ]);

    const totalRevenue = await prisma.gameEntry.aggregate({
        where: { paidAt: { not: null } },
        _sum: { paidAmount: true },
    });

    return {
        totalEntries,
        paidEntries,
        freeEntries,
        pendingEntries: totalEntries - paidEntries - freeEntries,
        claimedPrizes,
        totalRevenue: totalRevenue._sum.paidAmount || 0,
        games,
    };
}

// ============================================
// PAGE
// ============================================

export default async function TicketsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; status?: string; game?: string; q?: string }>;
}) {
    const resolvedParams = await searchParams;
    const { entries, total, page, pageSize } = await getTickets(resolvedParams);
    const stats = await getStats();
    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-display">Tickets</h1>
                    <p className="text-white/60 mt-1">
                        Manage game entries and ticket purchases
                    </p>
                </div>
            </div>

            <IssueFreeTicketCard games={stats.games} />

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#FFC931]/10">
                            <TicketIcon className="w-5 h-5 text-[#FFC931]" />
                        </div>
                        <div>
                            <p className="text-white/50 text-sm">Total Entries</p>
                            <p className="text-2xl font-bold text-white font-display">{stats.totalEntries}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#14B985]/10">
                            <CheckCircleIcon className="w-5 h-5 text-[#14B985]" />
                        </div>
                        <div>
                            <p className="text-white/50 text-sm">Paid</p>
                            <p className="text-2xl font-bold text-[#14B985] font-display">{stats.paidEntries}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#FB72FF]/10">
                            <ClockIcon className="w-5 h-5 text-[#FB72FF]" />
                        </div>
                        <div>
                            <p className="text-white/50 text-sm">Pending</p>
                            <p className="text-2xl font-bold text-[#FB72FF] font-display">{stats.pendingEntries}</p>
                        </div>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#00CFF2]/10">
                            <span className="text-lg">💰</span>
                        </div>
                        <div>
                            <p className="text-white/50 text-sm">Revenue</p>
                            <p className="text-2xl font-bold text-[#00CFF2] font-display">${stats.totalRevenue.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                {/* Status Filters */}
                <div className="flex gap-2">
                    {[
                        { label: "All", value: undefined },
                        { label: "Paid", value: "paid" },
                        { label: "Free", value: "free" },
                        { label: "Unpaid", value: "unpaid" },
                        { label: "Claimed", value: "claimed" },
                    ].map((filter) => (
                        <Link
                            key={filter.label}
                            href={`/admin/tickets${filter.value ? `?status=${filter.value}` : ""}${resolvedParams.game ? `&game=${resolvedParams.game}` : ""}`}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${(resolvedParams.status || undefined) === filter.value
                                ? "bg-[#FFC931] text-black shadow-lg shadow-[#FFC931]/20"
                                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            {filter.label}
                        </Link>
                    ))}
                </div>

                {/* Game Filter */}
                <GameFilter games={stats.games} />
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Player
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Game
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Amount
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Score / Rank
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Prize
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Date
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
                                                <TicketIcon className="w-8 h-8 text-white/30" />
                                            </div>
                                            <p className="text-lg font-medium text-white mb-1 font-display">
                                                No tickets found
                                            </p>
                                            <p className="text-sm text-white/50">
                                                Try adjusting your filters
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                entries.map((entry) => (
                                    <tr key={entry.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/admin/users/${entry.userId}`}
                                                className="flex items-center gap-3 hover:opacity-80"
                                            >
                                                <div className="h-8 w-8 bg-[#FFC931]/20 rounded-full flex items-center justify-center text-[#FFC931] font-bold text-sm">
                                                    {entry.user.username?.[0]?.toUpperCase() || "U"}
                                                </div>
                                                <span className="text-white font-medium">
                                                    {entry.user.username || `User ${entry.userId}`}
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/admin/games/${entry.gameId}`}
                                                className="text-white/80 hover:text-[#FFC931] transition-colors"
                                            >
                                                {entry.game.title}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {entry.claimedAt ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#00CFF2]/15 text-[#00CFF2]">
                                                    Claimed
                                                </span>
                                            ) : entry.purchaseSource === "FREE_ADMIN" ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#FB72FF]/15 text-[#FB72FF]">
                                                    Free
                                                </span>
                                            ) : entry.paidAt ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#14B985]/15 text-[#14B985]">
                                                    <span className="w-1.5 h-1.5 bg-[#14B985] rounded-full mr-1.5" />
                                                    Paid
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-white/50">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {typeof entry.paidAmount === "number" ? (
                                                <span className="text-[#14B985] font-mono font-medium">
                                                    ${entry.paidAmount.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-white/30">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-white">
                                                {entry.score > 0 ? (
                                                    <>
                                                        <span className="font-bold">{entry.score}</span>
                                                        {entry.rank && (
                                                            <span className="text-white/50 ml-2">
                                                                #{entry.rank}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-white/30">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {entry.prize ? (
                                                <span className="text-[#FFC931] font-mono font-bold">
                                                    ${entry.prize.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-white/30">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/50">
                                            {entry.createdAt.toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-white/50">
                        Page <span className="text-white font-medium">{page}</span> of{" "}
                        <span className="text-white font-medium">{totalPages}</span>
                        <span className="text-white/30 ml-2">({total} total)</span>
                    </p>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link
                                href={`?page=${page - 1}${resolvedParams.status ? `&status=${resolvedParams.status}` : ""}${resolvedParams.game ? `&game=${resolvedParams.game}` : ""}`}
                                className="px-4 py-2 border border-white/10 rounded-xl hover:bg-white/5 text-sm font-medium text-white transition-colors"
                            >
                                Previous
                            </Link>
                        )}
                        {page < totalPages && (
                            <Link
                                href={`?page=${page + 1}${resolvedParams.status ? `&status=${resolvedParams.status}` : ""}${resolvedParams.game ? `&game=${resolvedParams.game}` : ""}`}
                                className="px-4 py-2 bg-[#FFC931] text-black rounded-xl hover:bg-[#FFD966] text-sm font-bold transition-colors"
                            >
                                Next
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
