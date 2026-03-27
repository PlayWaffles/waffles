import { prisma } from "@/lib/db";
import { StatsCard } from "@/components/admin/StatsCard";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { PlatformFilter } from "@/components/admin/PlatformFilter";
import {
    UsersIcon,
    TrophyIcon,
    BanknotesIcon,
    TicketIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { getGamePhase } from "@/lib/types";
import { buildPlatformWhere } from "@/lib/admin-utils";
import { getDisplayName } from "@/lib/address";

async function getStats(platform?: string) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pf = buildPlatformWhere(platform);

    const gpf = pf.platform ? { game: pf } : {};

    const [
        totalUsers,
        activeUsers,
        totalGames,
        liveGames,
        totalEntries,
        paidEntries,
        recentUsers,
        recentEntries,
        revenueResult,
    ] = await Promise.all([
        prisma.user.count({ where: pf }),
        prisma.user.count({ where: { ...pf, lastLoginAt: { not: null } } }),
        prisma.game.count({ where: pf }),
        prisma.game.count({
            where: { ...pf, startsAt: { lte: now }, endsAt: { gt: now } },
        }),
        prisma.gameEntry.count({ where: gpf }),
        prisma.gameEntry.count({ where: { paidAt: { not: null }, ...gpf } }),
        prisma.user.findMany({
            where: { ...pf, createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true },
        }),
        prisma.gameEntry.findMany({
            where: {
                paidAt: { not: null, gte: sevenDaysAgo },
                ...gpf,
            },
            select: {
                paidAt: true,
                paidAmount: true,
            },
        }),
        prisma.game.aggregate({
            where: pf,
            _sum: { prizePool: true },
        }),
    ]);

    const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
        return d.toISOString().split('T')[0];
    });

    const userGrowth = dates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        count: recentUsers.filter((u: { createdAt: Date }) => u.createdAt.toISOString().startsWith(date)).length
    }));

    const revenueData = dates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        amount: recentEntries
            .filter((e: { paidAt: Date | null }) => e.paidAt?.toISOString().startsWith(date))
            .reduce((sum: number, e: { paidAmount: number | null }) => sum + (e.paidAmount || 0), 0)
    }));

    return {
        totalUsers,
        activeUsers,
        totalGames,
        liveGames,
        totalTickets: totalEntries,
        paidTickets: paidEntries,
        totalRevenue: revenueResult._sum.prizePool || 0,
        userGrowth,
        revenueData,
    };
}

async function getRecentActivity(platform?: string) {
    const pf = buildPlatformWhere(platform);

    const [games, users] = await Promise.all([
        prisma.game.findMany({
            where: pf,
            take: 3,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                platform: true,
                title: true,
                startsAt: true,
                endsAt: true,
                playerCount: true,
            },
        }),
        prisma.user.findMany({
            where: pf,
            take: 3,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                username: true,
                wallet: true,
                platform: true,
                createdAt: true,
            },
        }),
    ]);

    return { games, users };
}

export default async function AdminDashboard({
    searchParams,
}: {
    searchParams: Promise<{ platform?: string }>;
}) {
    const { platform } = await searchParams;
    const [stats, activity] = await Promise.all([
        getStats(platform),
        getRecentActivity(platform),
    ]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-body">Dashboard</h1>
                    <p className="text-white/60 mt-1 font-display">
                        Overview of your Waffles trivia platform
                    </p>
                </div>
                <PlatformFilter />
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Users"
                    value={stats.totalUsers.toLocaleString()}
                    subtitle={`${stats.activeUsers} signed in`}
                    icon={<UsersIcon className="h-6 w-6 text-[#00CFF2]" />}
                    glowVariant="cyan"
                />
                <StatsCard
                    title="Total Games"
                    value={stats.totalGames}
                    subtitle={`${stats.liveGames} live now`}
                    icon={<TrophyIcon className="h-6 w-6 text-[#FB72FF]" />}
                    glowVariant="pink"
                />
                <StatsCard
                    title="Revenue"
                    value={`$${stats.totalRevenue.toLocaleString()}`}
                    subtitle="USDC"
                    icon={<BanknotesIcon className="h-6 w-6 text-[#FFC931]" />}
                    glowVariant="gold"
                />
                <StatsCard
                    title="Tickets Sold"
                    value={stats.paidTickets.toLocaleString()}
                    subtitle={`${stats.totalTickets} total`}
                    icon={<TicketIcon className="h-6 w-6 text-[#14B985]" />}
                    glowVariant="success"
                />
            </div>

            {/* Charts */}
            <DashboardCharts
                userGrowth={stats.userGrowth}
                revenueData={stats.revenueData}
            />

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-display">
                {/* Recent Games */}
                <div className="bg-linear-to-br from-[#FB72FF]/5 to-transparent border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white font-body">Recent Games</h2>
                        <Link href="/admin/games" className="text-sm text-[#FFC931] hover:underline">View all</Link>
                    </div>
                    <div className="divide-y divide-white/10">
                        {activity.games.length === 0 ? (
                            <div className="p-6 text-center text-white/50">No games yet</div>
                        ) : (
                            activity.games.map((game) => {
                                const phase = getGamePhase(game);
                                return (
                                    <div key={game.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/3 transition-colors">
                                        <div>
                                            <p className="font-medium text-white">{game.title}</p>
                                            <p className="text-xs text-white/50">{new Date(game.startsAt).toLocaleDateString()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${phase === "LIVE"
                                                ? "bg-[#14B985]/20 text-[#14B985]"
                                                : "bg-white/10 text-white/60"
                                                }`}>
                                                {phase}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* New Users */}
                <div className="bg-linear-to-br from-[#00CFF2]/5 to-transparent border border-white/10 rounded-2xl overflow-hidden font-display">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white font-body">New Users</h2>
                        <Link href="/admin/users" className="text-sm text-[#FFC931] hover:underline">View all</Link>
                    </div>
                    <div className="divide-y divide-white/10">
                        {activity.users.length === 0 ? (
                            <div className="p-6 text-center text-white/50">No users yet</div>
                        ) : (
                            activity.users.map((user) => (
                                <div key={user.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/3 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-[#FFC931]/20 rounded-full flex items-center justify-center text-[#FFC931] font-bold text-xs">
                                            {user.username?.[0] || "U"}
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{getDisplayName({ username: user.username, wallet: user.wallet })}</p>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ${user.platform === "MINIPAY"
                                                    ? "bg-[#14B985]/15 text-[#14B985]"
                                                    : "bg-[#1B8FF5]/15 text-[#72C3FF]"
                                                    }`}>
                                                    {user.platform}
                                                </span>
                                                <span className="text-xs text-white/50">
                                                    {user.username ? `@${user.username}` : user.wallet || "No handle"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-white/50">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
