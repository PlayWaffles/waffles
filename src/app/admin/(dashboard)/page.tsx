import { prisma } from "@/lib/db";
import { StatsCard } from "@/components/admin/StatsCard";
import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { PlatformFilter } from "@/components/admin/PlatformFilter";
import { DashboardTimeframeFilter, type DashboardTimeframe } from "@/components/admin/DashboardTimeframeFilter";
import {
    UsersIcon,
    TrophyIcon,
    BanknotesIcon,
    TicketIcon,
    MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { getGamePhase } from "@/lib/types";
import {
    buildPlatformWhere,
    buildProductionEntryWhere,
    buildProductionGameWhere,
    calculateProtocolRevenue,
} from "@/lib/admin-utils";
import { getDisplayName } from "@/lib/address";
import { Prisma, UserPlatform } from "@prisma";

type TrendDirection = "up" | "down" | "flat";
type WeekOverWeekTrend = {
    value: string;
    direction: TrendDirection;
    label?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DASHBOARD_PLATFORM = UserPlatform.MINIPAY;
const DEFAULT_DASHBOARD_TIMEFRAME: DashboardTimeframe = "7d";
const DASHBOARD_TIMEFRAME_DAYS: Partial<Record<DashboardTimeframe, number>> = {
    current: 1,
    "7d": 7,
    "14d": 14,
    "30d": 30,
};
const DASHBOARD_TIMEFRAMES = new Set<DashboardTimeframe>(["current", "7d", "14d", "30d", "all"]);
const DASHBOARD_TIMEFRAME_LABELS: Record<DashboardTimeframe, string> = {
    current: "today",
    "7d": "last 7 days",
    "14d": "last 14 days",
    "30d": "last 30 days",
    all: "all time",
};
const DASHBOARD_TREND_LABELS: Record<DashboardTimeframe, string> = {
    current: "vs yesterday",
    "7d": "vs previous 7 days",
    "14d": "vs previous 14 days",
    "30d": "vs previous 30 days",
    all: "vs all time",
};

function formatCompactNumber(value: number) {
    return value.toLocaleString("en-US", {
        maximumFractionDigits: value >= 10 ? 0 : 1,
    });
}

function formatCurrency(value: number) {
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function formatWeekOverWeekTrend(
    current: number,
    previous: number,
    formatValue: (value: number) => string = formatCompactNumber,
    label = "vs previous period"
): WeekOverWeekTrend {
    if (current === previous) {
        return { value: "0%", direction: "flat", label };
    }

    if (previous === 0) {
        return {
            value: `+${formatValue(current)}`,
            direction: "up",
            label: "new this period",
        };
    }

    const change = ((current - previous) / previous) * 100;
    const absChange = Math.abs(change);
    const formattedChange = absChange >= 10 ? absChange.toFixed(0) : absChange.toFixed(1);

    return {
        value: `${formattedChange}%`,
        direction: change > 0 ? "up" : "down",
        label,
    };
}

function parseDashboardTimeframe(value?: string): DashboardTimeframe {
    return DASHBOARD_TIMEFRAMES.has(value as DashboardTimeframe)
        ? value as DashboardTimeframe
        : DEFAULT_DASHBOARD_TIMEFRAME;
}

function getDateKey(date: Date) {
    return date.toISOString().split("T")[0];
}

function getMetricWindow(timeframe: DashboardTimeframe, now: Date) {
    const days = DASHBOARD_TIMEFRAME_DAYS[timeframe];
    if (!days) return null;

    const start = new Date(now.getTime() - (days - 1) * DAY_MS);
    start.setHours(0, 0, 0, 0);

    return {
        start,
        previousStart: new Date(start.getTime() - days * DAY_MS),
        previousEnd: start,
        days,
    };
}

async function getStats(platform: string | undefined, timeframe: DashboardTimeframe) {
    const now = new Date();
    const pf = buildPlatformWhere(platform);
    const gamePf = buildProductionGameWhere(platform);
    const metricWindow = getMetricWindow(timeframe, now);
    const baseEntryWhere: Prisma.GameEntryWhereInput = { game: gamePf };
    const entryWhere: Prisma.GameEntryWhereInput = metricWindow
        ? { ...baseEntryWhere, createdAt: { gte: metricWindow.start } }
        : baseEntryWhere;
    const paidEntryWhere: Prisma.GameEntryWhereInput = {
        ...baseEntryWhere,
        paidAt: metricWindow ? { not: null, gte: metricWindow.start } : { not: null },
    };
    const previousPaidEntryWhere: Prisma.GameEntryWhereInput = metricWindow
        ? {
            ...baseEntryWhere,
            paidAt: {
                not: null,
                gte: metricWindow.previousStart,
                lt: metricWindow.previousEnd,
            },
        }
        : { ...entryWhere, paidAt: { not: null } };
    const userWhere: Prisma.UserWhereInput = metricWindow
        ? { ...pf, createdAt: { gte: metricWindow.start } }
        : pf;
    const activeUserWhere: Prisma.UserWhereInput = metricWindow
        ? { ...pf, lastLoginAt: { gte: metricWindow.start } }
        : { ...pf, lastLoginAt: { not: null } };
    const gameWhere: Prisma.GameWhereInput = metricWindow
        ? { ...gamePf, startsAt: { gte: metricWindow.start } }
        : gamePf;
    const previousUserWhere: Prisma.UserWhereInput = metricWindow
        ? { ...pf, createdAt: { gte: metricWindow.previousStart, lt: metricWindow.previousEnd } }
        : pf;
    const previousGameWhere: Prisma.GameWhereInput = metricWindow
        ? { ...gamePf, startsAt: { gte: metricWindow.previousStart, lt: metricWindow.previousEnd } }
        : gamePf;
    const chartDays = timeframe === "current" ? 2 : metricWindow?.days ?? 7;
    const chartStart = timeframe === "current" && metricWindow
        ? metricWindow.previousStart
        : metricWindow?.start ?? new Date(now.getTime() - (chartDays - 1) * DAY_MS);
    const dates = Array.from({ length: chartDays }, (_, i) => {
        const date = new Date(chartStart.getTime() + i * DAY_MS);
        return getDateKey(date);
    });
    const chartUserWhere: Prisma.UserWhereInput = { ...pf, createdAt: { gte: chartStart } };
    const chartPaidEntryWhere: Prisma.GameEntryWhereInput = {
        ...baseEntryWhere,
        paidAt: { not: null, gte: chartStart },
    };
    const entrySelect = {
        paidAt: true,
        paidAmount: true,
        game: {
            select: {
                id: true,
                title: true,
                startsAt: true,
            },
        },
    } satisfies Prisma.GameEntrySelect;

    const [
        totalUsers,
        activeUsers,
        totalGames,
        liveGames,
        totalEntries,
        paidEntries,
        recentUsers,
        recentEntries,
        chartEntries,
        previousUsers,
        previousGames,
        previousEntries,
        totalPaidAmount,
    ] = await Promise.all([
        prisma.user.count({ where: userWhere }),
        prisma.user.count({ where: activeUserWhere }),
        prisma.game.count({ where: gameWhere }),
        prisma.game.count({
            where: { ...gamePf, startsAt: { lte: now }, endsAt: { gt: now } },
        }),
        prisma.gameEntry.count({ where: entryWhere }),
        prisma.gameEntry.count({ where: paidEntryWhere }),
        prisma.user.findMany({
            where: chartUserWhere,
            select: { createdAt: true },
        }),
        prisma.gameEntry.findMany({
            where: paidEntryWhere,
            select: entrySelect,
        }),
        prisma.gameEntry.findMany({
            where: chartPaidEntryWhere,
            select: entrySelect,
        }),
        metricWindow ? prisma.user.count({ where: previousUserWhere }) : Promise.resolve(0),
        metricWindow ? prisma.game.count({ where: previousGameWhere }) : Promise.resolve(0),
        metricWindow
            ? prisma.gameEntry.findMany({
                where: previousPaidEntryWhere,
                select: {
                    paidAmount: true,
                },
            })
            : Promise.resolve([]),
        prisma.gameEntry.aggregate({
            where: paidEntryWhere,
            _sum: { paidAmount: true },
        }),
    ]);

    const userGrowth = dates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        count: recentUsers.filter((u: { createdAt: Date }) => getDateKey(u.createdAt) === date).length
    }));

    const revenueData = dates.map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        amount: chartEntries
            .filter((e: { paidAt: Date | null }) => e.paidAt && getDateKey(e.paidAt) === date)
            .reduce((sum: number, e: { paidAmount: number | null }) => sum + calculateProtocolRevenue(e.paidAmount), 0)
    }));
    const revenueByGame = Array.from(
        chartEntries.reduce((games, entry) => {
            const existing = games.get(entry.game.id) ?? {
                date: entry.game.title,
                amount: 0,
                startsAt: entry.game.startsAt,
            };

            existing.amount += calculateProtocolRevenue(entry.paidAmount);
            games.set(entry.game.id, existing);

            return games;
        }, new Map<string, { date: string; amount: number; startsAt: Date }>())
            .values()
    )
        .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
        .slice(0, 7)
        .map(({ date, amount }) => ({ date, amount }));

    const currentRevenue = recentEntries.reduce(
        (sum, entry) => sum + calculateProtocolRevenue(entry.paidAmount),
        0
    );
    const previousRevenue = previousEntries.reduce(
        (sum, entry) => sum + calculateProtocolRevenue(entry.paidAmount),
        0
    );
    const showPeriodTrend = Boolean(metricWindow);
    const trendLabel = DASHBOARD_TREND_LABELS[timeframe];

    return {
        totalUsers,
        activeUsers,
        totalGames,
        liveGames,
        totalTickets: totalEntries,
        paidTickets: paidEntries,
        totalRevenue: calculateProtocolRevenue(totalPaidAmount._sum.paidAmount),
        userGrowth,
        revenueData,
        revenueByGame,
        weekOverWeek: {
            users: showPeriodTrend ? formatWeekOverWeekTrend(totalUsers, previousUsers, formatCompactNumber, trendLabel) : undefined,
            games: showPeriodTrend ? formatWeekOverWeekTrend(totalGames, previousGames, formatCompactNumber, trendLabel) : undefined,
            revenue: showPeriodTrend ? formatWeekOverWeekTrend(
                currentRevenue,
                previousRevenue,
                (value) => `$${formatCompactNumber(value)}`,
                trendLabel
            ) : undefined,
            tickets: showPeriodTrend ? formatWeekOverWeekTrend(recentEntries.length, previousEntries.length, formatCompactNumber, trendLabel) : undefined,
        },
    };
}

async function getRecentActivity(platform?: string) {
    const pf = buildPlatformWhere(platform);
    const gamePf = buildProductionGameWhere(platform);
    const entryPf = buildProductionEntryWhere(platform);

    const [games, users, ticketBuys] = await Promise.all([
        prisma.game.findMany({
            where: gamePf,
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
        prisma.gameEntry.findMany({
            where: {
                ...entryPf,
                paidAt: { not: null },
            },
            take: 5,
            orderBy: { paidAt: "desc" },
            select: {
                id: true,
                paidAt: true,
                paidAmount: true,
                user: {
                    select: {
                        username: true,
                        wallet: true,
                        platform: true,
                    },
                },
                game: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
        }),
    ]);

    return { games, users, ticketBuys };
}

export default async function AdminDashboard({
    searchParams,
}: {
    searchParams: Promise<{ platform?: string; timeframe?: string }>;
}) {
    const { platform, timeframe } = await searchParams;
    const activePlatform = platform === "ALL" ? undefined : platform ?? DEFAULT_DASHBOARD_PLATFORM;
    const activeTimeframe = parseDashboardTimeframe(timeframe);
    const timeframeLabel = DASHBOARD_TIMEFRAME_LABELS[activeTimeframe];
    const [stats, activity] = await Promise.all([
        getStats(activePlatform, activeTimeframe),
        getRecentActivity(activePlatform),
    ]);
    const scopedLabel = timeframeLabel;

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-body">Dashboard</h1>
                    <p className="text-white/60 mt-1 font-display">
                        Overview of your Waffles trivia platform
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <DashboardTimeframeFilter activeTimeframe={activeTimeframe} />
                    <PlatformFilter defaultPlatform={DEFAULT_DASHBOARD_PLATFORM} />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Total Users"
                    value={stats.totalUsers.toLocaleString()}
                    subtitle={`${stats.activeUsers} active · ${scopedLabel}`}
                    trend={stats.weekOverWeek.users}
                    icon={<UsersIcon className="h-6 w-6 text-[#00CFF2]" />}
                    glowVariant="cyan"
                />
                <StatsCard
                    title="Total Games"
                    value={stats.totalGames}
                    subtitle={`${stats.liveGames} live now · ${scopedLabel}`}
                    trend={stats.weekOverWeek.games}
                    icon={<TrophyIcon className="h-6 w-6 text-[#FB72FF]" />}
                    glowVariant="pink"
                />
                <StatsCard
                    title="Protocol Revenue"
                    value={`$${formatCurrency(stats.totalRevenue)}`}
                    subtitle={`20% fee share · ${scopedLabel}`}
                    trend={stats.weekOverWeek.revenue}
                    icon={<BanknotesIcon className="h-6 w-6 text-[#FFC931]" />}
                    glowVariant="gold"
                />
                <StatsCard
                    title="Tickets Sold"
                    value={stats.paidTickets.toLocaleString()}
                    subtitle={`${stats.totalTickets} total · ${scopedLabel}`}
                    trend={stats.weekOverWeek.tickets}
                    icon={<TicketIcon className="h-6 w-6 text-[#14B985]" />}
                    glowVariant="success"
                />
            </div>

            {/* Charts */}
            <DashboardCharts
                userGrowth={stats.userGrowth}
                revenueData={stats.revenueData}
                revenueByGame={stats.revenueByGame}
            />

            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#FFC931]/6 to-transparent p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-white font-body">User Lookup</h2>
                        <p className="mt-1 text-sm text-white/60">
                            Search the users dashboard by wallet address, username, or FID.
                        </p>
                    </div>
                    <form action="/admin/users" method="GET" className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
                        <div className="relative flex-1">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                            <input
                                type="text"
                                name="q"
                                placeholder="Paste wallet address, @username, or FID"
                                className="w-full rounded-xl border border-white/10 bg-transparent py-3 pl-10 pr-4 text-white placeholder-white/40 transition-all focus:border-[#FFC931]/50 focus:ring-2 focus:ring-[#FFC931]/20"
                            />
                        </div>
                        <button
                            type="submit"
                            className="rounded-xl bg-[#FFC931] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#FFD966]"
                        >
                            Find User
                        </button>
                    </form>
                </div>
            </div>

            {/* Recent Activity Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 font-display">
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

            <div className="font-display">

                {/* Recent Ticket Buys */}
                <div className="bg-linear-to-br from-[#14B985]/5 to-transparent border border-white/10 rounded-2xl overflow-hidden font-display">
                    <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white font-body">Recent Ticket Buys</h2>
                        <Link href="/admin/tickets" className="text-sm text-[#FFC931] hover:underline">View all</Link>
                    </div>
                    <div className="divide-y divide-white/10">
                        {activity.ticketBuys.length === 0 ? (
                            <div className="p-6 text-center text-white/50">No paid tickets yet</div>
                        ) : (
                            activity.ticketBuys.map((entry) => (
                                <div key={entry.id} className="px-6 py-4 hover:bg-white/3 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-medium text-white truncate">
                                                {getDisplayName({
                                                    username: entry.user.username,
                                                    wallet: entry.user.wallet,
                                                })}
                                            </p>
                                            <p className="text-xs text-white/50 truncate mt-1">
                                                {entry.game.title}
                                            </p>
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ${entry.user.platform === "MINIPAY"
                                                    ? "bg-[#14B985]/15 text-[#14B985]"
                                                    : "bg-[#1B8FF5]/15 text-[#72C3FF]"
                                                    }`}>
                                                    {entry.user.platform}
                                                </span>
                                                <span className="text-xs text-white/50">
                                                    {entry.paidAt ? new Date(entry.paidAt).toLocaleString() : "Pending"}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="font-semibold text-[#14B985]">
                                                ${entry.paidAmount?.toLocaleString() ?? 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
