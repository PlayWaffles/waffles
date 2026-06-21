import { prisma } from "@/lib/db";
import Link from "next/link";
import { Suspense } from "react";
import {
    BanknotesIcon,
    UsersIcon,
    TrophyIcon,
    ArrowTrendingUpIcon,
    FireIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
    DateRangePicker,
    getDateRangeFromParam,
    KPICard,
    RevenueChart,
    HourlyUserActivityChart,
    GamePerformanceTable,
    QuestionDifficulty,
    PlayerEngagement,
    AnalyticsTabs,
    MetricTooltip,
    type AnalyticsTab,
} from "@/components/admin/analytics";
import { isGameVisibleToPlatform } from "@/lib/platform/query";
import { getGamePhase } from "@/lib/types";
import { getDisplayName } from "@/lib/address";
import {
    buildPlatformWhere,
    buildPaidProductionEntryWhere,
    buildProductionEntryWhere,
    buildProductionGameWhere,
    calculateProtocolRevenue,
} from "@/lib/admin-utils";
import { getHourlyUmamiActivity } from "@/lib/umami";
import type { GameNetwork, UserPlatform } from "@prisma";

// ============================================================
// HELPERS
// ============================================================

interface AnswerData {
    selected: number;
    correct: boolean;
    points: number;
    ms: number;
}

interface RevenueEntryWithGame {
    paidAt: Date | null;
    paidAmount: number | null;
    game: {
        id: string;
        title: string;
        theme: string;
        playerCount: number;
        startsAt: Date;
        endsAt: Date;
    };
}

interface GameScoreAggregate {
    gameId: string;
    _avg: {
        score: number | null;
    };
}

type HourlyUserRow = {
    id: string;
    createdAt: Date;
    lastLoginAt: Date | null;
};

type OnboardingWaitBucket = {
    label: string;
    minMs: number;
    maxMs: number;
};

type OnboardingDiagnosticSegment = {
    label: string;
    users: number;
    ticketBuyers: number;
    conversionRate: number;
    nextGameBuyers?: number;
    nextGameConversionRate?: number;
};

type EntrySource = "home" | "post_first_level_upsell" | "unknown";

type EntrySourceSegment = {
    source: EntrySource;
    label: string;
    purchases: number;
    buyers: number;
    revenue: number;
    started: number;
    startRate: number;
    noShows: number;
    noShowRate: number;
};

type LevelTrackKey = "STANDARD" | "WORLD_CUP";

type LevelProgressionPlayer = {
    userId: string;
    name: string;
    platform: string;
    highestLevel: number;
    standardLevel: number | null;
    worldCupLevel: number | null;
    updatedAt: Date;
};

type AnalyticsGameFilterOption = {
    id: string;
    title: string;
    platform: UserPlatform;
    network: GameNetwork;
    startsAt: Date;
    endsAt: Date;
    playerCount: number;
};

type AnalyticsGameFilterData = {
    selectedGameId: string | null;
    selectedGame: AnalyticsGameFilterOption | null;
    currentGame: AnalyticsGameFilterOption | null;
    previousGame: AnalyticsGameFilterOption | null;
    comparisonGame: AnalyticsGameFilterOption | null;
    options: AnalyticsGameFilterOption[];
};

const ONBOARDING_WAIT_BUCKETS: OnboardingWaitBucket[] = [
    { label: "<15m", minMs: 0, maxMs: 15 * 60 * 1000 },
    { label: "15m-1h", minMs: 15 * 60 * 1000, maxMs: 60 * 60 * 1000 },
    { label: "1-3h", minMs: 60 * 60 * 1000, maxMs: 3 * 60 * 60 * 1000 },
    { label: "3-12h", minMs: 3 * 60 * 60 * 1000, maxMs: 12 * 60 * 60 * 1000 },
    { label: "12-24h", minMs: 12 * 60 * 60 * 1000, maxMs: 24 * 60 * 60 * 1000 },
    { label: "1-3d", minMs: 24 * 60 * 60 * 1000, maxMs: 3 * 24 * 60 * 60 * 1000 },
    { label: "3d+", minMs: 3 * 24 * 60 * 60 * 1000, maxMs: Infinity },
];

function rate(numerator: number, denominator: number) {
    return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function getWaitBucket(waitMs: number) {
    return ONBOARDING_WAIT_BUCKETS.find(
        (bucket) => waitMs >= bucket.minMs && waitMs < bucket.maxMs,
    ) ?? ONBOARDING_WAIT_BUCKETS[ONBOARDING_WAIT_BUCKETS.length - 1];
}

function addOnboardingSegment(
    map: Map<string, OnboardingDiagnosticSegment>,
    label: string,
    boughtTicket: boolean,
    boughtNextGame?: boolean,
) {
    const segment = map.get(label) ?? {
        label,
        users: 0,
        ticketBuyers: 0,
        conversionRate: 0,
        nextGameBuyers: 0,
        nextGameConversionRate: 0,
    };

    segment.users += 1;
    if (boughtTicket) segment.ticketBuyers += 1;
    if (boughtNextGame) segment.nextGameBuyers = (segment.nextGameBuyers ?? 0) + 1;
    map.set(label, segment);
}

function analyticsObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function analyticsNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function entrySource(value: unknown): EntrySource {
    return value === "home" || value === "post_first_level_upsell"
        ? value
        : "unknown";
}

function entrySourceLabel(source: EntrySource) {
    if (source === "home") return "Home";
    if (source === "post_first_level_upsell") return "Post-level upsell";
    return "Unknown";
}

function finalizeOnboardingSegments(
    map: Map<string, OnboardingDiagnosticSegment>,
    options?: { includeNextGameConversion?: boolean; limit?: number },
) {
    return Array.from(map.values())
        .map((segment) => ({
            ...segment,
            conversionRate: rate(segment.ticketBuyers, segment.users),
            nextGameConversionRate: options?.includeNextGameConversion
                ? rate(segment.nextGameBuyers ?? 0, segment.users)
                : undefined,
        }))
        .sort((a, b) => b.users - a.users)
        .slice(0, options?.limit);
}

function formatGameHour(startsAt: Date) {
    return `${String(startsAt.getUTCHours()).padStart(2, "0")}:00 UTC`;
}

function formatGameDateTime(value: Date) {
    return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        timeZoneName: "short",
    }).format(value);
}

function formatTicketPrice(prices: number[]) {
    const price = Math.min(...prices.filter((value) => Number.isFinite(value)));
    return Number.isFinite(price) ? `$${price.toFixed(price % 1 === 0 ? 0 : 2)}` : "No price";
}

function formatHourLabel(hour: number) {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
}

function buildHourlyUserActivityData(
    users: HourlyUserRow[],
    umamiSessionsByHour: number[],
    start: Date,
    end: Date,
) {
    const arrivalsByHour = Array.from({ length: 24 }, () => new Set<string>());
    const returningByHour = Array.from({ length: 24 }, () => new Set<string>());

    for (const user of users) {
        if (user.createdAt >= start && user.createdAt <= end) {
            arrivalsByHour[user.createdAt.getHours()].add(user.id);
        }

        if (user.lastLoginAt && user.lastLoginAt >= start && user.lastLoginAt <= end && user.createdAt < start) {
            const hour = user.lastLoginAt.getHours();
            arrivalsByHour[hour].add(user.id);
            returningByHour[hour].add(user.id);
        }
    }

    return Array.from({ length: 24 }, (_, hour) => ({
        hour: formatHourLabel(hour),
        totalArrivals: arrivalsByHour[hour].size,
        returningUsers: returningByHour[hour].size,
        activeUsers: umamiSessionsByHour[hour] ?? 0,
    }));
}

function buildAnalyticsFilterHref({
    tab,
    range,
    startDate,
    endDate,
    platform,
    gameId,
}: {
    tab: AnalyticsTab;
    range: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
    gameId?: string | null;
}) {
    const params = new URLSearchParams({ tab, range });
    if (range === "custom" && startDate && endDate) {
        params.set("startDate", startDate);
        params.set("endDate", endDate);
    }
    if (platform) params.set("platform", platform);
    if (gameId) params.set("gameId", gameId);
    return `/admin/analytics?${params.toString()}`;
}

function buildTicketPurchaseWhere(
    start: Date,
    end: Date,
    gpf: Record<string, unknown>,
) {
    return {
        ...gpf,
        paidAt: { not: null, gte: start, lte: end },
    };
}

function summarizeRevenueByGame(entries: RevenueEntryWithGame[]) {
    const gameRevenueMap = new Map<string, {
        id: string;
        title: string;
        theme: string;
        playerCount: number;
        ticketCount: number;
        grossRevenue: number;
        startsAt: Date;
        endsAt: Date;
    }>();

    entries.forEach((entry) => {
        const existing = gameRevenueMap.get(entry.game.id) ?? {
            id: entry.game.id,
            title: entry.game.title,
            theme: entry.game.theme,
            playerCount: entry.game.playerCount,
            ticketCount: 0,
            grossRevenue: 0,
            startsAt: entry.game.startsAt,
            endsAt: entry.game.endsAt,
        };

        existing.ticketCount += 1;
        existing.grossRevenue += entry.paidAmount || 0;
        existing.playerCount = Math.max(existing.playerCount, entry.game.playerCount);
        gameRevenueMap.set(entry.game.id, existing);
    });

    return Array.from(gameRevenueMap.values())
        .map((game) => ({
            ...game,
            revenue: calculateProtocolRevenue(game.grossRevenue),
        }))
        .sort((a, b) => b.revenue - a.revenue);
}

function attachAverageScores<
    T extends {
        id: string;
        title: string;
        theme: string;
        playerCount: number;
        ticketCount: number;
        revenue: number;
        startsAt: Date;
        endsAt: Date;
    },
>(games: T[], scoreAggregates: GameScoreAggregate[]) {
    const scoreMap = new Map(
        scoreAggregates.map((row) => [row.gameId, row._avg.score ?? 0]),
    );

    return games.map((game) => ({
        id: game.id,
        title: game.title,
        theme: game.theme,
        status: getGamePhase(game),
        playerCount: game.playerCount,
        ticketCount: game.ticketCount,
        revenue: game.revenue,
        avgScore: scoreMap.get(game.id) ?? 0,
    }));
}

async function getAnalyticsGameFilterData(platform?: string, selectedGameId?: string): Promise<AnalyticsGameFilterData> {
    const gamePf = buildProductionGameWhere(platform);
    const now = new Date();
    const [currentGame, selectedGame, options] = await Promise.all([
        prisma.game.findFirst({
            where: { ...gamePf, endsAt: { gt: now } },
            orderBy: { startsAt: "asc" },
            select: {
                id: true,
                title: true,
                platform: true,
                network: true,
                startsAt: true,
                endsAt: true,
                playerCount: true,
            },
        }),
        selectedGameId
            ? prisma.game.findFirst({
                where: { ...gamePf, id: selectedGameId },
                select: {
                    id: true,
                    title: true,
                    platform: true,
                    network: true,
                    startsAt: true,
                    endsAt: true,
                    playerCount: true,
                },
            })
            : Promise.resolve(null),
        prisma.game.findMany({
            where: gamePf,
            orderBy: { startsAt: "desc" },
            select: {
                id: true,
                title: true,
                platform: true,
                network: true,
                startsAt: true,
                endsAt: true,
                playerCount: true,
            },
            take: 24,
        }),
    ]);

    if (selectedGameId && !selectedGame) {
        throw new Error(`Selected analytics game was not found: ${selectedGameId}`);
    }

    const previousBaseGame = currentGame ?? selectedGame;
    const previousGame = previousBaseGame
        ? await prisma.game.findFirst({
            where: {
                ...gamePf,
                platform: previousBaseGame.platform,
                network: previousBaseGame.network,
                endsAt: { lt: previousBaseGame.startsAt },
            },
            orderBy: { endsAt: "desc" },
            select: {
                id: true,
                title: true,
                platform: true,
                network: true,
                startsAt: true,
                endsAt: true,
                playerCount: true,
            },
        })
        : null;
    const comparisonBaseGame = selectedGame ?? currentGame;
    const comparisonGame = comparisonBaseGame
        ? comparisonBaseGame.id === previousBaseGame?.id
            ? previousGame
            : await prisma.game.findFirst({
                where: {
                    ...gamePf,
                    platform: comparisonBaseGame.platform,
                    network: comparisonBaseGame.network,
                    endsAt: { lt: comparisonBaseGame.startsAt },
                },
                orderBy: { endsAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    platform: true,
                    network: true,
                    startsAt: true,
                    endsAt: true,
                    playerCount: true,
                },
            })
        : null;

    return {
        selectedGameId: selectedGameId ?? null,
        selectedGame,
        currentGame,
        previousGame,
        comparisonGame,
        options,
    };
}

// ============================================================
// 1. CORE DASHBOARD (The "first dashboard" metrics)
// ============================================================

async function getCoreDashboard(
    start: Date,
    end: Date,
    platform?: string,
    selectedGameId?: string,
    gameFilter?: AnalyticsGameFilterData,
) {
    const now = new Date();
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const pf = buildPlatformWhere(platform);
    const gamePf = buildProductionGameWhere(platform);
    const gpf = buildProductionEntryWhere(platform);
    const ticketPurchaseWhere = selectedGameId
        ? { ...gpf, gameId: selectedGameId, paidAt: { not: null } }
        : buildTicketPurchaseWhere(start, end, gpf);
    const previousTicketPurchaseWhere = selectedGameId && gameFilter?.comparisonGame
        ? { ...gpf, gameId: gameFilter.comparisonGame.id, paidAt: { not: null } }
        : buildTicketPurchaseWhere(previousStart, start, gpf);

    // Helper to build date range for daily aggregation
    const buildDailyMap = (startDate: Date, endDate: Date) => {
        const map = new Map<string, number>();
        const d = new Date(startDate);
        while (d <= endDate) {
            map.set(d.toISOString().split("T")[0], 0);
            d.setDate(d.getDate() + 1);
        }
        return map;
    };

    const [
        // Active users in period (login/session activity)
        activeUsersInPeriod,
        previousActiveUsers,
        // DAU: users active in last 24h
        dauUsers,
        // Total signups vs onboarded (hasGameAccess)
        totalSignups,
        onboardedUsers,
        // Ticket activation
        totalEntriesInPeriod,
        previousEntriesInPeriod,
        // Ticket claim → completion (answered > 0)
        completedEntries,
        // Entries with leftAt set (left during game)
        leftEntries,
        // New users who reached first ticket in period
        activatedUsers,
        // Average score across all ticketed entries
        avgScoreResult,
        // Average answer speed (need to compute from JSON)
        entriesWithAnswers,
        // Prize claims
        totalPrizes,
        claimedPrizes,
        // Daily signups sparkline
        dailySignups,
        // Revenue entries for chart + summaries
        revenueEntries,
        gameScoreAverages,
        hourlyUsers,
        umamiSessionsByHour,
    ] = await Promise.all([
        // Active players in period
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: { not: null, gte: start, lte: end },
            },
        }),
        // Previous period active users
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: { not: null, gte: previousStart, lt: start },
            },
        }),
        // DAU: users active in last 24h
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: {
                    not: null,
                    gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                },
            },
        }),
        // Total signups in period
        prisma.user.count({ where: { ...pf, createdAt: { gte: start, lte: end } } }),
        // Onboarded users created in period
        prisma.user.count({
            where: {
                ...pf,
                createdAt: { gte: start, lte: end },
                OR: [
                    { hasGameAccess: true },
                    { accessGrantedAt: { not: null } },
                    { entries: { some: { game: gamePf } } },
                ],
            },
        }),
        // Total entries (ticket purchases) in period
        prisma.gameEntry.count({ where: ticketPurchaseWhere }),
        // Previous period entries
        prisma.gameEntry.count({ where: previousTicketPurchaseWhere }),
        // Completed entries (answered at least 1 question)
        prisma.gameEntry.count({ where: { ...ticketPurchaseWhere, answered: { gt: 0 } } }),
        // Left entries
        prisma.gameEntry.count({ where: { ...ticketPurchaseWhere, leftAt: { not: null } } }),
        // D1: new users in period who also have an entry
        prisma.user.count({
            where: {
                ...pf,
                createdAt: { gte: start, lte: end },
                entries: {
                    some: selectedGameId
                        ? { ...buildPaidProductionEntryWhere(platform), gameId: selectedGameId }
                        : { ...buildPaidProductionEntryWhere(platform), game: gamePf },
                },
            },
        }),
        // Average score
        prisma.gameEntry.aggregate({
            where: { ...ticketPurchaseWhere, answered: { gt: 0 } },
            _avg: { score: true },
        }),
        // Entries with answers for speed computation
        prisma.gameEntry.findMany({
            where: { ...ticketPurchaseWhere, answered: { gt: 0 } },
            select: { answers: true },
            take: 5000,
        }),
        // Total prizes awarded
        prisma.gameEntry.count({ where: { prize: { not: null, gt: 0 }, ...ticketPurchaseWhere } }),
        // Claimed prizes
        prisma.gameEntry.count({ where: { claimedAt: { not: null }, prize: { gt: 0 }, ...ticketPurchaseWhere } }),
        // Daily signups for sparkline
        prisma.user.groupBy({
            by: ["createdAt"],
            where: { ...pf, createdAt: { gte: start, lte: end } },
            _count: true,
        }),
        // Revenue entries for sparkline + summaries
        prisma.gameEntry.findMany({
            where: ticketPurchaseWhere,
            select: {
                paidAt: true,
                paidAmount: true,
                game: {
                    select: {
                        id: true,
                        title: true,
                        theme: true,
                        playerCount: true,
                        startsAt: true,
                        endsAt: true,
                    },
                },
            },
        }),
        prisma.gameEntry.groupBy({
            by: ["gameId"],
            where: { ...ticketPurchaseWhere, answered: { gt: 0 } },
            _avg: { score: true },
        }),
        prisma.user.findMany({
            where: {
                ...pf,
                OR: [
                    { createdAt: { gte: start, lte: end } },
                    { lastLoginAt: { not: null, gte: start, lte: end } },
                ],
            },
            select: {
                id: true,
                createdAt: true,
                lastLoginAt: true,
            },
            take: 20000,
        }),
        getHourlyUmamiActivity(start, end),
    ]);

    // Compute average answer speed from JSON
    let totalMs = 0;
    let msCount = 0;
    for (const entry of entriesWithAnswers) {
        const answers = entry.answers as Record<string, AnswerData> | null;
        if (!answers || typeof answers !== "object") continue;
        for (const a of Object.values(answers)) {
            if (a.ms > 0) {
                totalMs += a.ms;
                msCount++;
            }
        }
    }
    const avgAnswerSpeed = msCount > 0 ? totalMs / msCount : 0;

    // Build sparklines
    const signupMap = buildDailyMap(start, end);
    dailySignups.forEach((d) => {
        const key = new Date(d.createdAt).toISOString().split("T")[0];
        signupMap.set(key, (signupMap.get(key) || 0) + d._count);
    });
    const signupSparkline = Array.from(signupMap.values()).slice(-7);

    const revenueMap = buildDailyMap(start, end);
    const ticketMap = buildDailyMap(start, end);
    revenueEntries.forEach((e) => {
        if (e.paidAt) {
            const key = new Date(e.paidAt).toISOString().split("T")[0];
            revenueMap.set(
                key,
                (revenueMap.get(key) || 0) + calculateProtocolRevenue(e.paidAmount),
            );
            ticketMap.set(key, (ticketMap.get(key) || 0) + 1);
        }
    });
    const gamesWithRevenue = summarizeRevenueByGame(revenueEntries as RevenueEntryWithGame[]);

    // Computed metrics
    const onboardingRate = totalSignups > 0 ? (onboardedUsers / totalSignups) * 100 : 0;
    const purchaseToCompletionRate = totalEntriesInPeriod > 0 ? (completedEntries / totalEntriesInPeriod) * 100 : 0;
    const leaveRate = totalEntriesInPeriod > 0 ? (leftEntries / totalEntriesInPeriod) * 100 : 0;
    const activationRate = totalSignups > 0 ? (activatedUsers / totalSignups) * 100 : 0;
    const avgScore = avgScoreResult._avg.score || 0;
    const totalRevenue = revenueEntries.reduce(
        (sum, entry) => sum + calculateProtocolRevenue(entry.paidAmount),
        0,
    );
    const revenueSparkline = selectedGameId
        ? [totalRevenue]
        : Array.from(revenueMap.values()).slice(-7);
    const revenuePerGame = gamesWithRevenue.length > 0
        ? totalRevenue / gamesWithRevenue.length
        : 0;
    const claimRate = totalPrizes > 0 ? (claimedPrizes / totalPrizes) * 100 : 0;
    const activeUsersChange = previousActiveUsers > 0
        ? ((activeUsersInPeriod - previousActiveUsers) / previousActiveUsers) * 100
        : 0;
    const entriesChange = previousEntriesInPeriod > 0
        ? ((totalEntriesInPeriod - previousEntriesInPeriod) / previousEntriesInPeriod) * 100
        : 0;

    // Revenue chart data (single pass — revenueMap and ticketMap built above)
    const sortedRevenueDates = Array.from(revenueMap.keys()).sort();
    const revenueChartData = selectedGameId
        ? gamesWithRevenue.map((game) => ({
            date: game.title,
            revenue: game.revenue,
            tickets: game.ticketCount,
        }))
        : sortedRevenueDates.map((date) => ({
            date: date.slice(5),
            revenue: revenueMap.get(date) || 0,
            tickets: ticketMap.get(date) || 0,
        }));
    const hourlyUserActivity = buildHourlyUserActivityData(hourlyUsers, umamiSessionsByHour, start, end);

    return {
        // KPIs
        activeUsers: activeUsersInPeriod,
        activeUsersChange,
        dau: dauUsers,
        onboardingRate,
        activationRate,
        purchaseToCompletionRate,
        leaveRate,
        avgScore,
        avgAnswerSpeed,
        totalRevenue,
        entriesChange,
        revenuePerGame,
        claimRate,
        totalEntriesInPeriod,
        // Sparklines
        signupSparkline,
        revenueSparkline,
        // Chart data
        revenueChartData,
        hourlyUserActivity,
        // Game performance table
        gamePerformance: attachAverageScores(gamesWithRevenue, gameScoreAverages),
    };
}

// ============================================================
// 1.5 ONBOARDING CONVERSION ANALYTICS
// ============================================================

async function getOnboardingConversionData(start: Date, end: Date, platform?: string) {
    const pf = buildPlatformWhere(platform);
    const gamePf = buildProductionGameWhere(platform);
    const onboardedUsers = await prisma.user.findMany({
        where: {
            ...pf,
            onboardingCompletedAt: { not: null, gte: start, lte: end },
        },
        select: {
            id: true,
            platform: true,
            referredById: true,
            onboardingCompletedAt: true,
            notifs: {
                select: { id: true },
                take: 1,
            },
            entries: {
                where: {
                    paidAt: { not: null },
                    ...buildProductionEntryWhere(platform),
                },
                select: {
                    gameId: true,
                    paidAt: true,
                    game: {
                        select: {
                            id: true,
                            platform: true,
                            network: true,
                            isTestnet: true,
                            startsAt: true,
                            theme: true,
                            tierPrices: true,
                        },
                    },
                },
                orderBy: { paidAt: "asc" },
            },
        },
    });

    const completed = onboardedUsers.length;
    const earliestCompletion = onboardedUsers.reduce<Date | null>((earliest, user) => {
        const completedAt = user.onboardingCompletedAt;
        if (!completedAt) return earliest;
        return !earliest || completedAt < earliest ? completedAt : earliest;
    }, null);

    const games = earliestCompletion
        ? await prisma.game.findMany({
            where: {
                ...gamePf,
                startsAt: { gte: earliestCompletion },
            },
            select: {
                id: true,
                platform: true,
                network: true,
                isTestnet: true,
                startsAt: true,
                theme: true,
                tierPrices: true,
                ticketOpenNotifsSent: true,
            },
            orderBy: { startsAt: "asc" },
            take: 5000,
        })
        : [];

    const bucketMap = new Map(ONBOARDING_WAIT_BUCKETS.map((bucket) => [
        bucket.label,
        {
            label: bucket.label,
            users: 0,
            nextGameBuyers: 0,
            conversionRate: 0,
        },
    ]));
    let noUpcomingGameUsers = 0;
    let noUpcomingGameBuyers = 0;
    let ticketBuyers = 0;
    let nextGameBuyers = 0;
    let laterGameBuyers = 0;

    const platformSegments = new Map<string, OnboardingDiagnosticSegment>();
    const referralSegments = new Map<string, OnboardingDiagnosticSegment>();
    const notificationSegments = new Map<string, OnboardingDiagnosticSegment>();
    const nextGameThemeSegments = new Map<string, OnboardingDiagnosticSegment>();
    const nextGameStartHourSegments = new Map<string, OnboardingDiagnosticSegment>();
    const nextGamePriceSegments = new Map<string, OnboardingDiagnosticSegment>();
    const nextGameReminderSegments = new Map<string, OnboardingDiagnosticSegment>();
    const purchasePathSegments = new Map<string, OnboardingDiagnosticSegment>();

    for (const user of onboardedUsers) {
        const completedAt = user.onboardingCompletedAt;
        if (!completedAt) continue;

        const visibleEntries = user.entries.filter((entry) =>
            isGameVisibleToPlatform(entry.game, user.platform as UserPlatform) &&
            entry.paidAt &&
            entry.paidAt >= completedAt
        );

        if (visibleEntries.length > 0) {
            ticketBuyers++;
        }

        const boughtTicket = visibleEntries.length > 0;
        const nextGame = games.find((game) =>
            game.startsAt >= completedAt &&
            isGameVisibleToPlatform(game, user.platform as UserPlatform)
        );
        const boughtNextGame = !!nextGame && visibleEntries.some((entry) =>
            entry.gameId === nextGame.id &&
            entry.paidAt &&
            entry.paidAt <= nextGame.startsAt
        );

        addOnboardingSegment(platformSegments, user.platform, boughtTicket, boughtNextGame);
        addOnboardingSegment(referralSegments, user.referredById ? "Referred" : "Direct / unknown", boughtTicket, boughtNextGame);
        addOnboardingSegment(notificationSegments, user.notifs.length > 0 ? "Notification token present" : "No notification token", boughtTicket, boughtNextGame);

        if (boughtNextGame) {
            nextGameBuyers++;
            addOnboardingSegment(purchasePathSegments, "Bought next game", true, true);
        } else if (boughtTicket) {
            laterGameBuyers++;
            addOnboardingSegment(purchasePathSegments, "Bought later game", true, false);
        } else {
            addOnboardingSegment(purchasePathSegments, "Did not buy", false, false);
        }

        if (!nextGame) {
            noUpcomingGameUsers++;
            if (visibleEntries.length > 0) noUpcomingGameBuyers++;
            continue;
        }

        addOnboardingSegment(nextGameThemeSegments, nextGame.theme, boughtTicket, boughtNextGame);
        addOnboardingSegment(nextGameStartHourSegments, formatGameHour(nextGame.startsAt), boughtTicket, boughtNextGame);
        addOnboardingSegment(nextGamePriceSegments, formatTicketPrice(nextGame.tierPrices), boughtTicket, boughtNextGame);
        addOnboardingSegment(
            nextGameReminderSegments,
            nextGame.ticketOpenNotifsSent.length > 0 ? "Game reminders sent" : "No game reminders sent",
            boughtTicket,
            boughtNextGame,
        );

        const waitMs = nextGame.startsAt.getTime() - completedAt.getTime();
        const bucket = getWaitBucket(waitMs);
        const row = bucketMap.get(bucket.label);
        if (!row) continue;

        row.users++;
        if (visibleEntries.some((entry) =>
            entry.gameId === nextGame.id &&
            entry.paidAt &&
            entry.paidAt <= nextGame.startsAt
        )) {
            row.nextGameBuyers++;
        }
    }

    const waitBuckets = Array.from(bucketMap.values()).map((bucket) => ({
        ...bucket,
        conversionRate: rate(bucket.nextGameBuyers, bucket.users),
    }));

    return {
        completed,
        ticketBuyers,
        ticketBuyerRate: rate(ticketBuyers, completed),
        nextGameBuyers,
        nextGameBuyerRate: rate(nextGameBuyers, completed),
        laterGameBuyers,
        laterGameBuyerRate: rate(laterGameBuyers, completed),
        waitBuckets,
        noUpcomingGame: {
            users: noUpcomingGameUsers,
            ticketBuyers: noUpcomingGameBuyers,
            conversionRate: rate(noUpcomingGameBuyers, noUpcomingGameUsers),
        },
        diagnostics: {
            platform: finalizeOnboardingSegments(platformSegments, { includeNextGameConversion: true }),
            referral: finalizeOnboardingSegments(referralSegments, { includeNextGameConversion: true }),
            notifications: finalizeOnboardingSegments(notificationSegments, { includeNextGameConversion: true }),
            nextGameTheme: finalizeOnboardingSegments(nextGameThemeSegments, { includeNextGameConversion: true }),
            nextGameStartHour: finalizeOnboardingSegments(nextGameStartHourSegments, { includeNextGameConversion: true, limit: 8 }),
            nextGamePrice: finalizeOnboardingSegments(nextGamePriceSegments, { includeNextGameConversion: true }),
            nextGameReminders: finalizeOnboardingSegments(nextGameReminderSegments, { includeNextGameConversion: true }),
            purchasePath: finalizeOnboardingSegments(purchasePathSegments),
        },
    };
}

// ============================================================
// 2. RETENTION ANALYTICS
// ============================================================

async function getRetentionData(
    start: Date,
    end: Date,
    platform?: string,
    range?: string,
    selectedGameId?: string,
) {
    const now = new Date();
    const isAllTime = range === "all";
    const pf = buildPlatformWhere(platform);
    const gpf = buildProductionEntryWhere(platform);
    const entryWhere = selectedGameId
        ? { ...gpf, gameId: selectedGameId, paidAt: { not: null } }
        : { paidAt: { not: null, gte: start, lte: end }, ...gpf };

    const [
        lifetimeUsers,
        // DAU / WAU / MAU
        dauUsers,
        wauUsers,
        mauUsers,
        // New vs returning in period
        newPlayersInPeriod,
        totalPlayersInPeriod,
        // Streak distribution
        streakDistribution,
        // Ticket buyers in period
        entriesInPeriod,
        // Users with last session info
        usersWithLastEntry,
    ] = await Promise.all([
        prisma.user.count({ where: pf }),
        // DAU: unique users with paid entry in last 24h
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: { not: null, gte: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
            },
        }),
        // WAU: last 7 days
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: { not: null, gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
            },
        }),
        // MAU: last 30 days
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: { not: null, gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
            },
        }),
        // New players: first entry in period
        prisma.user.count({
            where: {
                ...pf,
                createdAt: { gte: start, lte: end },
                lastLoginAt: { not: null, gte: start, lte: end },
            },
        }),
        // Total active users in period
        prisma.user.count({
            where: {
                ...pf,
                lastLoginAt: { not: null, gte: start, lte: end },
            },
        }),
        // Login streak distribution from User model
        prisma.user.groupBy({
            by: ["currentStreak"],
            where: { ...pf, currentStreak: { gt: 0 } },
            _count: true,
            orderBy: { currentStreak: "asc" },
        }),
        prisma.gameEntry.findMany({
            where: entryWhere,
            select: {
                userId: true,
                user: {
                    select: {
                        createdAt: true,
                    },
                },
            },
        }),
        // Days since last session (last entry per user)
        prisma.user.findMany({
            where: { ...pf, lastLoginAt: { not: null } },
            select: { lastLoginAt: true },
        }),
    ]);

    const returningPlayers = totalPlayersInPeriod - newPlayersInPeriod;
    const entryUsers = new Map<string, {
        entryCount: number;
        createdAt: Date;
    }>();

    entriesInPeriod.forEach((entry) => {
        const existing = entryUsers.get(entry.userId) ?? {
            entryCount: 0,
            createdAt: entry.user.createdAt,
        };
        existing.entryCount += 1;
        entryUsers.set(entry.userId, existing);
    });

    const usersWithEntries = Array.from(entryUsers.values());
    const totalBuyers = usersWithEntries.length;
    const repeatBuyers = usersWithEntries.filter((user) => user.entryCount > 1).length;
    const repeatBuyerRate = totalBuyers > 0 ? (repeatBuyers / totalBuyers) * 100 : 0;
    const newPlayersWithTicket = usersWithEntries.filter(
        (user) => user.createdAt >= start && user.createdAt <= end,
    ).length;
    const returningPlayersWithTicket = usersWithEntries.filter(
        (user) => user.createdAt < start,
    ).length;

    const playerBaseTotal = isAllTime ? lifetimeUsers : newPlayersInPeriod + returningPlayers;
    const resolvedNewPlayers = isAllTime ? lifetimeUsers : newPlayersInPeriod;
    const resolvedReturningPlayers = isAllTime ? repeatBuyers : returningPlayers;
    const resolvedReturningPlayersWithTicket = isAllTime
        ? repeatBuyers
        : returningPlayersWithTicket;

    // Streak distribution buckets
    const streakBuckets = [
        { range: "1", min: 1, max: 1 },
        { range: "2-3", min: 2, max: 3 },
        { range: "4-7", min: 4, max: 7 },
        { range: "8-14", min: 8, max: 14 },
        { range: "15+", min: 15, max: Infinity },
    ];
    const streakData = streakBuckets.map(({ range, min, max }) => ({
        range,
        count: streakDistribution
            .filter((s) => s.currentStreak >= min && s.currentStreak <= max)
            .reduce((sum, s) => sum + s._count, 0),
    }));

    // Days since last session distribution
    const daysSinceBuckets = [
        { range: "Today", min: 0, max: 0 },
        { range: "1-2d", min: 1, max: 2 },
        { range: "3-7d", min: 3, max: 7 },
        { range: "8-14d", min: 8, max: 14 },
        { range: "15-30d", min: 15, max: 30 },
        { range: "30d+", min: 31, max: Infinity },
    ];
    const daysSinceData = daysSinceBuckets.map(({ range, min, max }) => {
        const count = usersWithLastEntry.filter((u) => {
            if (!u.lastLoginAt) return false;
            const days = Math.floor((now.getTime() - new Date(u.lastLoginAt).getTime()) / (1000 * 60 * 60 * 24));
            return days >= min && days <= max;
        }).length;
        return { range, count };
    });

    return {
        dau: dauUsers,
        wau: wauUsers,
        mau: mauUsers,
        dauWauRatio: wauUsers > 0 ? ((dauUsers / wauUsers) * 100) : 0,
        isAllTime,
        playerBaseTotal,
        newPlayers: resolvedNewPlayers,
        newPlayersWithTicket,
        returningPlayers: resolvedReturningPlayers,
        returningPlayersWithTicket: resolvedReturningPlayersWithTicket,
        repeatBuyerRate,
        repeatBuyers,
        totalBuyers,
        streakDistribution: streakData,
        daysSinceLastSession: daysSinceData,
    };
}

// ============================================================
// 3. GAMEPLAY QUALITY
// ============================================================

async function getGameplayData(
    start: Date,
    end: Date,
    platform: string | undefined,
    selectedGameId: string | undefined,
    gameFilter: AnalyticsGameFilterData,
) {
    const gamePf = buildProductionGameWhere(platform);
    const gpf = buildPaidProductionEntryWhere(platform);
    const now = new Date();
    const currentOrNextGame = gameFilter.currentGame;
    const selectedGame = gameFilter.selectedGame;
    const scopedGameWhere = selectedGameId
        ? { ...gamePf, id: selectedGameId }
        : { ...gamePf, startsAt: { gte: start, lte: end } };
    const scopedEntryWhere = selectedGameId
        ? { ...gpf, gameId: selectedGameId }
        : { ...gpf, game: scopedGameWhere };
    const ticketPurchaseWhere = selectedGameId
        ? { ...gpf, gameId: selectedGameId, paidAt: { not: null } }
        : buildTicketPurchaseWhere(start, end, gpf);

    const latestFiveEndedGames = await prisma.game.findMany({
        where: {
            ...gamePf,
            endsAt: { lt: now },
        },
        orderBy: { endsAt: "desc" },
        select: { id: true },
        take: 5,
    });
    const latestFiveEndedGameIds = latestFiveEndedGames.map((game) => game.id);
    const answeredPlayersAcrossLastFiveGames = latestFiveEndedGameIds.length > 0
        ? await prisma.gameEntry.groupBy({
            by: ["userId"],
            where: {
                ...gpf,
                gameId: { in: latestFiveEndedGameIds },
                answered: { gt: 0 },
            },
        }).then((rows) => rows.length)
        : 0;

    const [
        entries,
        questionsRaw,
        // Rank distribution
        rankedEntries,
        // Win rate (rank 1)
        winnersCount,
        totalRankedEntries,
        // Theme participation
        themeParticipation,
        entrySourceEvents,
        entrySourceEntries,
    ] = await Promise.all([
        prisma.gameEntry.findMany({
            where: scopedEntryWhere,
            select: {
                score: true,
                answered: true,
                answers: true,
                rank: true,
                leftAt: true,
                createdAt: true,
                paidAmount: true,
                game: {
                    select: {
                        id: true,
                        title: true,
                        theme: true,
                        startsAt: true,
                    },
                },
            },
            take: 10000,
        }),
        prisma.question.findMany({
            where: { game: scopedGameWhere },
            select: {
                id: true,
                gameId: true,
                content: true,
                correctIndex: true,
                roundIndex: true,
                orderInRound: true,
                game: { select: { title: true } },
            },
        }),
        prisma.gameEntry.findMany({
            where: { ...scopedEntryWhere, rank: { not: null } },
            select: { rank: true, createdAt: true, game: { select: { startsAt: true } } },
        }),
        prisma.gameEntry.count({ where: { ...scopedEntryWhere, rank: 1 } }),
        prisma.gameEntry.count({ where: { ...scopedEntryWhere, rank: { not: null } } }),
        prisma.game.groupBy({
            by: ["theme"],
            where: scopedGameWhere,
            _sum: { playerCount: true },
            _count: true,
            _avg: { prizePool: true },
        }),
        prisma.analyticsEvent.findMany({
            where: {
                name: "ticket_purchase_authoritative",
                ...(selectedGameId ? {} : { createdAt: { gte: start, lte: end } }),
            },
            select: {
                userId: true,
                properties: true,
            },
            take: 10000,
        }),
        prisma.gameEntry.findMany({
            where: ticketPurchaseWhere,
            select: {
                gameId: true,
                userId: true,
                answered: true,
            },
            take: 10000,
        }),
    ]);

    const comparableGame = selectedGame ?? currentOrNextGame;
    if (selectedGameId && !selectedGame) {
        throw new Error(`Selected analytics game was not found: ${selectedGameId}`);
    }

    const previousComparableGame = comparableGame
        ? await prisma.game.findFirst({
            where: {
                ...gamePf,
                platform: comparableGame.platform,
                network: comparableGame.network,
                endsAt: { lt: comparableGame.startsAt },
            },
            orderBy: { endsAt: "desc" },
            select: {
                id: true,
                title: true,
                startsAt: true,
                endsAt: true,
            },
        })
        : null;
    const [currentComparableEntries, previousComparableEntries] = comparableGame
        ? await Promise.all([
            prisma.gameEntry.findMany({
                where: { gameId: comparableGame.id, ...gpf },
                select: {
                    userId: true,
                },
            }),
            previousComparableGame
                ? prisma.gameEntry.findMany({
                    where: { gameId: previousComparableGame.id, ...gpf },
                    select: {
                        userId: true,
                        answered: true,
                    },
                })
                : Promise.resolve([]),
        ])
        : [[], []];

    const priorCurrentCohortUsers = comparableGame
        ? await prisma.gameEntry.findMany({
            where: {
                ...gpf,
                userId: { in: currentComparableEntries.map((entry) => entry.userId) },
                game: { startsAt: { lt: comparableGame.startsAt } },
            },
            select: { userId: true },
            distinct: ["userId"],
        })
        : [];

    const gameQuestions = new Map<string, typeof questionsRaw>();
    for (const question of questionsRaw) {
        const existing = gameQuestions.get(question.gameId) ?? [];
        existing.push(question);
        gameQuestions.set(question.gameId, existing);
    }

    const firstQuestionIds = new Set<string>();
    const lastQuestionIds = new Set<string>();
    const gameQuestionCounts = new Map<string, number>();
    for (const [gameId, questions] of gameQuestions.entries()) {
        const ordered = [...questions].sort((a, b) =>
            a.roundIndex - b.roundIndex || a.orderInRound - b.orderInRound
        );
        const lastQuestion = ordered[ordered.length - 1];
        if (ordered[0]) firstQuestionIds.add(ordered[0].id);
        if (lastQuestion) lastQuestionIds.add(lastQuestion.id);
        gameQuestionCounts.set(gameId, ordered.length);
    }

    // Single pass over entries: accuracy, speed, completion, leave rate, and behavior stats
    let totalCorrect = 0;
    let totalAnswered = 0;
    let totalMs = 0;
    let msCount = 0;
    const scores: number[] = [];
    let playedCount = 0;
    let leftCount = 0;
    const questionStatsMap = new Map<string, { total: number; correct: number; totalMs: number; msCount: number }>();
    const ticketStats = { entries: 0, noShow: 0, partial: 0, completedAll: 0, revenue: 0, noShowRevenue: 0 };
    const answerQuality = { correct: 0, answered: 0, totalMs: 0, msCount: 0, totalPoints: 0 };
    let lateEntries = 0;
    let latePlayed = 0;
    let lateNoShows = 0;
    let startedEntries = 0;
    let reachedFinalQuestion = 0;

    for (const entry of entries) {
        scores.push(entry.score);
        if (entry.leftAt) leftCount++;
        const questionCount = gameQuestionCounts.get(entry.game.id) ?? 0;
        const isLate = entry.createdAt > entry.game.startsAt;

        ticketStats.entries++;
        ticketStats.revenue += entry.paidAmount ?? 0;
        if (isLate) lateEntries++;

        const answers = entry.answers as Record<string, AnswerData> | null;
        if (!answers || typeof answers !== "object") continue;
        const answerEntries = Object.entries(answers);
        const answeredQuestionIds = new Set(answerEntries.map(([qId]) => qId));

        if (entry.answered > 0) {
            playedCount++;
            if (isLate) latePlayed++;
        } else {
            ticketStats.noShow++;
            ticketStats.noShowRevenue += entry.paidAmount ?? 0;
            if (isLate) lateNoShows++;
        }

        if (entry.answered > 0 && firstQuestionIds.size > 0) {
            for (const qId of answeredQuestionIds) {
                if (firstQuestionIds.has(qId)) {
                    startedEntries++;
                    break;
                }
            }
        }

        if (entry.answered > 0 && lastQuestionIds.size > 0) {
            for (const qId of answeredQuestionIds) {
                if (lastQuestionIds.has(qId)) {
                    reachedFinalQuestion++;
                    break;
                }
            }
        }

        if (questionCount > 0) {
            if (entry.answered >= questionCount) {
                ticketStats.completedAll++;
            } else if (entry.answered > 0) {
                ticketStats.partial++;
            }
        }

        for (const [qId, a] of answerEntries) {
            totalAnswered++;
            if (a.correct) totalCorrect++;
            if (a.ms > 0) { totalMs += a.ms; msCount++; }
            answerQuality.answered++;
            if (a.correct) answerQuality.correct++;
            answerQuality.totalPoints += a.points;
            if (a.ms > 0) {
                answerQuality.totalMs += a.ms;
                answerQuality.msCount++;
            }
            // Per-question stats
            const existing = questionStatsMap.get(qId) || { total: 0, correct: 0, totalMs: 0, msCount: 0 };
            existing.total++;
            if (a.correct) existing.correct++;
            if (a.ms > 0) { existing.totalMs += a.ms; existing.msCount++; }
            questionStatsMap.set(qId, existing);
        }
    }

    const avgAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;
    const avgAnswerTime = msCount > 0 ? totalMs / msCount : 0;
    const completionRate = entries.length > 0 ? (playedCount / entries.length) * 100 : 0;
    const leaveRate = entries.length > 0 ? (leftCount / entries.length) * 100 : 0;
    const winRate = totalRankedEntries > 0 ? (winnersCount / totalRankedEntries) * 100 : 0;

    // Score distribution
    const scoreBuckets = [
        { range: "0-9,999", min: 0, max: 9_999 },
        { range: "10k-19k", min: 10_000, max: 19_999 },
        { range: "20k-29k", min: 20_000, max: 29_999 },
        { range: "30k-39k", min: 30_000, max: 39_999 },
        { range: "40k-49k", min: 40_000, max: 49_999 },
        { range: "50k-59k", min: 50_000, max: 59_999 },
        { range: "60k-69k", min: 60_000, max: 69_999 },
        { range: "70k-79k", min: 70_000, max: 79_999 },
        { range: "80k-89k", min: 80_000, max: 89_999 },
        { range: "90k+", min: 90_000, max: Infinity },
    ];
    const scoreDistribution = scoreBuckets.map(({ range, min, max }) => ({
        range,
        count: scores.filter((s) => s >= min && s <= max).length,
    }));

    // Rank distribution
    const rankBuckets = [
        { range: "1st", min: 1, max: 1 },
        { range: "2-3", min: 2, max: 3 },
        { range: "4-10", min: 4, max: 10 },
        { range: "11-25", min: 11, max: 25 },
        { range: "26-50", min: 26, max: 50 },
        { range: "51+", min: 51, max: Infinity },
    ];
    const rankDistribution = rankBuckets.map(({ range, min, max }) => {
        const count = rankedEntries.filter((e) => e.rank! >= min && e.rank! <= max).length;
        return {
            range,
            count,
            percentage: totalRankedEntries > 0 ? (count / totalRankedEntries) * 100 : 0,
        };
    });

    const questionMap = new Map(questionsRaw.map((q) => [q.id, q]));
    const questions = Array.from(questionStatsMap.entries())
        .filter(([qId]) => questionMap.has(qId))
        .map(([qId, stats]) => {
            const q = questionMap.get(qId)!;
            return {
                id: qId,
                content: q.content,
                gameTitle: q.game.title,
                totalAnswers: stats.total,
                correctAnswers: stats.correct,
                avgLatencyMs: stats.msCount > 0 ? Math.round(stats.totalMs / stats.msCount) : 0,
                accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
            };
        });

    // Theme participation
    const themeData = themeParticipation.map((t) => ({
        theme: t.theme,
        games: t._count,
        players: t._sum.playerCount || 0,
        avgPrizePool: t._avg.prizePool || 0,
    }));

    const ticketTop10 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 10
    ).length;
    const lateTop10 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 10 && entry.createdAt > entry.game.startsAt
    ).length;
    const lateTop3 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 3 && entry.createdAt > entry.game.startsAt
    ).length;

    const currentTicketUsers = new Set(currentComparableEntries.map((entry) => entry.userId));
    const previousParticipants = new Set(
        previousComparableEntries
            .filter((entry) => entry.answered > 0)
            .map((entry) => entry.userId),
    );
    const previousTicketUsers = new Set(previousComparableEntries.map((entry) => entry.userId));
    const priorAnyTicketUsers = new Set(priorCurrentCohortUsers.map((entry) => entry.userId));

    const summarizeCurrentTicketBuyers = () => {
        const count = currentTicketUsers.size;
        let playedLastGame = 0;
        let boughtLastGame = 0;
        let firstTime = 0;

        for (const userId of currentTicketUsers) {
            if (previousParticipants.has(userId)) playedLastGame++;
            if (previousTicketUsers.has(userId)) boughtLastGame++;
            if (!priorAnyTicketUsers.has(userId)) firstTime++;
        }

        return {
            count,
            playedLastGame,
            playedLastGameRate: count > 0 ? (playedLastGame / count) * 100 : 0,
            boughtLastGame,
            boughtLastGameRate: count > 0 ? (boughtLastGame / count) * 100 : 0,
            firstTime,
            firstTimeRate: count > 0 ? (firstTime / count) * 100 : 0,
        };
    };

    const currentTicketBuyers = comparableGame && previousComparableGame
        ? {
            currentGameTitle: comparableGame.title,
            previousGameTitle: previousComparableGame.title,
            buyers: summarizeCurrentTicketBuyers(),
        }
        : null;

    const entryByUserAndGame = new Map(
        entrySourceEntries.map((entry) => [`${entry.userId}:${entry.gameId}`, entry]),
    );
    const entrySourceMap = new Map<EntrySource, EntrySourceSegment & { buyerIds: Set<string> }>();
    for (const source of ["home", "post_first_level_upsell", "unknown"] as const) {
        entrySourceMap.set(source, {
            source,
            label: entrySourceLabel(source),
            purchases: 0,
            buyers: 0,
            revenue: 0,
            started: 0,
            startRate: 0,
            noShows: 0,
            noShowRate: 0,
            buyerIds: new Set<string>(),
        });
    }

    for (const event of entrySourceEvents) {
        if (!event.userId) continue;
        const properties = analyticsObject(event.properties);
        if (platform && properties.platform !== platform) continue;
        const gameId = typeof properties.game_id === "string" ? properties.game_id : null;
        if (!gameId) continue;
        if (selectedGameId && gameId !== selectedGameId) continue;
        const source = entrySource(properties.entry_source);
        const segment = entrySourceMap.get(source);
        if (!segment) continue;
        const entry = entryByUserAndGame.get(`${event.userId}:${gameId}`);
        segment.purchases += 1;
        segment.buyerIds.add(event.userId);
        segment.revenue += analyticsNumber(properties.revenue);
        if (entry?.answered && entry.answered > 0) segment.started += 1;
        else segment.noShows += 1;
    }

    const entrySourceComparison = Array.from(entrySourceMap.values())
        .map(({ buyerIds, ...segment }) => ({
            ...segment,
            buyers: buyerIds.size,
            startRate: segment.purchases > 0 ? (segment.started / segment.purchases) * 100 : 0,
            noShowRate: segment.purchases > 0 ? (segment.noShows / segment.purchases) * 100 : 0,
        }))
        .filter((segment) => segment.purchases > 0 || segment.source !== "unknown");

    return {
        avgAccuracy,
        avgAnswerTime,
        completionRate,
        leaveRate,
        winRate,
        avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        answeredPlayersAcrossLastFiveGames,
        totalPlayers: entries.length,
        scoreDistribution,
        rankDistribution,
        totalRankedEntries,
        questions,
        themeParticipation: themeData,
        currentTicketBuyers,
        entrySourceComparison,
        behavior: {
            tickets: {
                entries: ticketStats.entries,
                completedAll: ticketStats.completedAll,
                partial: ticketStats.partial,
                noShow: ticketStats.noShow,
                noShowRate: ticketStats.entries > 0
                    ? (ticketStats.noShow / ticketStats.entries) * 100
                    : 0,
            },
            monetization: {
                ticketRevenue: ticketStats.revenue,
                noShowRevenue: ticketStats.noShowRevenue,
                noShowRevenueRate: ticketStats.revenue > 0
                    ? (ticketStats.noShowRevenue / ticketStats.revenue) * 100
                    : 0,
            },
            lateEntry: {
                entries: lateEntries,
                rate: entries.length > 0 ? (lateEntries / entries.length) * 100 : 0,
                played: latePlayed,
                noShows: lateNoShows,
                top10: lateTop10,
                top3: lateTop3,
            },
            startLine: {
                started: startedEntries,
                startRate: entries.length > 0 ? (startedEntries / entries.length) * 100 : 0,
                reachedFinalQuestion,
                finishRateAfterStart: startedEntries > 0 ? (reachedFinalQuestion / startedEntries) * 100 : 0,
            },
            answerQuality: {
                accuracy: answerQuality.answered > 0
                    ? (answerQuality.correct / answerQuality.answered) * 100
                    : 0,
                avgResponseMs: answerQuality.msCount > 0
                    ? answerQuality.totalMs / answerQuality.msCount
                    : 0,
                avgPointsPerAnswer: answerQuality.answered > 0
                    ? answerQuality.totalPoints / answerQuality.answered
                    : 0,
            },
            leaderboard: {
                ticketTop10,
            },
        },
    };
}

// ============================================================
// 4. REVENUE ANALYTICS
// ============================================================

async function getRevenueData(
    start: Date,
    end: Date,
    platform?: string,
    selectedGameId?: string,
    gameFilter?: AnalyticsGameFilterData,
) {
    const gpf = buildProductionEntryWhere(platform);
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const revenueWhere = selectedGameId
        ? { ...gpf, gameId: selectedGameId, paidAt: { not: null } }
        : { paidAt: { not: null, gte: start, lte: end }, ...gpf };
    const previousRevenueWhere = selectedGameId && gameFilter?.comparisonGame
        ? { ...gpf, gameId: gameFilter.comparisonGame.id, paidAt: { not: null } }
        : { paidAt: { not: null, gte: previousStart, lt: start }, ...gpf };
    const lifetimeRevenueWhere = selectedGameId
        ? { ...gpf, gameId: selectedGameId, paidAt: { not: null } }
        : { paidAt: { not: null }, ...gpf };

    const [
        currentRevenue,
        previousRevenue,
        totalEntries,
        previousEntries,
        // Revenue per user
        uniqueBuyers,
        // Avg ticket amount
        avgTicket,
        // Tickets per user
        ticketCounts,
        // Prize stats
        totalPrizesAwarded,
        totalPrizesClaimed,
        unclaimedPrizeAmount,
        // Daily breakdown
        dailyEntries,
        topGameScoreAverages,
        // Lifetime value
        lifetimeRevenue,
    ] = await Promise.all([
        prisma.gameEntry.aggregate({ where: revenueWhere, _sum: { paidAmount: true } }),
        prisma.gameEntry.aggregate({ where: previousRevenueWhere, _sum: { paidAmount: true } }),
        prisma.gameEntry.count({ where: revenueWhere }),
        prisma.gameEntry.count({ where: previousRevenueWhere }),
        prisma.gameEntry.groupBy({ by: ["userId"], where: revenueWhere }).then((r) => r.length),
        prisma.gameEntry.aggregate({ where: revenueWhere, _avg: { paidAmount: true } }),
        prisma.gameEntry.groupBy({ by: ["userId"], where: revenueWhere, _count: true }),
        prisma.gameEntry.aggregate({ where: { prize: { gt: 0 }, ...revenueWhere }, _count: true, _sum: { prize: true } }),
        prisma.gameEntry.aggregate({ where: { prize: { gt: 0 }, claimedAt: { not: null }, ...revenueWhere }, _count: true, _sum: { prize: true } }),
        prisma.gameEntry.aggregate({ where: { prize: { gt: 0 }, claimedAt: null, ...revenueWhere }, _sum: { prize: true } }),
        prisma.gameEntry.findMany({
            where: revenueWhere,
            select: {
                paidAt: true,
                paidAmount: true,
                game: {
                    select: {
                        id: true,
                        title: true,
                        theme: true,
                        playerCount: true,
                        startsAt: true,
                        endsAt: true,
                    },
                },
            },
        }),
        prisma.gameEntry.groupBy({
            by: ["gameId"],
            where: {
                ...revenueWhere,
                answered: { gt: 0 },
            },
            _avg: { score: true },
        }),
        prisma.gameEntry.aggregate({ where: lifetimeRevenueWhere, _sum: { paidAmount: true } }),
    ]);

    const revenue = calculateProtocolRevenue(currentRevenue._sum.paidAmount);
    const prevRevenue = calculateProtocolRevenue(previousRevenue._sum.paidAmount);
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const entriesChange = previousEntries > 0 ? ((totalEntries - previousEntries) / previousEntries) * 100 : 0;
    const revenuePerActiveUser = uniqueBuyers > 0 ? revenue / uniqueBuyers : 0;
    const avgTicketAmount = avgTicket._avg.paidAmount || 0;
    const ticketsPerUser = ticketCounts.length > 0
        ? ticketCounts.reduce((sum, t) => sum + t._count, 0) / ticketCounts.length
        : 0;
    const claimRate = (totalPrizesAwarded._count || 0) > 0
        ? ((totalPrizesClaimed._count || 0) / (totalPrizesAwarded._count || 1)) * 100
        : 0;
    const lifetimeRevenuePerUser = uniqueBuyers > 0
        ? calculateProtocolRevenue(lifetimeRevenue._sum.paidAmount) / uniqueBuyers
        : 0;

    // Daily chart data
    const dailyMap = new Map<string, { revenue: number; tickets: number }>();
    {
        const d = new Date(start);
        while (d <= end) {
            dailyMap.set(d.toISOString().split("T")[0], { revenue: 0, tickets: 0 });
            d.setDate(d.getDate() + 1);
        }
    }
    dailyEntries.forEach((e) => {
        if (e.paidAt) {
            const key = new Date(e.paidAt).toISOString().split("T")[0];
            const existing = dailyMap.get(key);
            if (existing) {
                existing.revenue += calculateProtocolRevenue(e.paidAmount);
                existing.tickets++;
            }
        }
    });
    const topGames = summarizeRevenueByGame(dailyEntries as RevenueEntryWithGame[]).slice(0, 10);
    const chartData = selectedGameId
        ? topGames.map((game) => ({
            date: game.title,
            revenue: game.revenue,
            tickets: game.ticketCount,
        }))
        : Array.from(dailyMap.entries()).sort().map(([date, data]) => ({
            date: date.slice(5),
            ...data,
        }));

    return {
        revenue,
        revenueChange,
        totalEntries,
        entriesChange,
        revenuePerActiveUser,
        avgTicketAmount,
        ticketsPerUser,
        claimRate,
        lifetimeRevenuePerUser,
        totalPrizesAwarded: totalPrizesAwarded._sum.prize || 0,
        totalPrizesClaimed: totalPrizesClaimed._sum.prize || 0,
        unclaimedPrizes: unclaimedPrizeAmount._sum.prize || 0,
        chartData,
        topGames: attachAverageScores(topGames, topGameScoreAverages),
        sparkline: chartData.slice(-7).map((d) => d.revenue),
    };
}

async function getLevelProgressionData(start: Date, end: Date, platform?: string) {
    const userWhere = {
        ...buildPlatformWhere(platform),
        isBanned: false,
    };

    const [progressRows, activeLevelers] = await Promise.all([
        prisma.levelProgress.findMany({
            where: { user: userWhere },
            orderBy: [{ level: "desc" }, { updatedAt: "desc" }],
            select: {
                userId: true,
                track: true,
                level: true,
                updatedAt: true,
                user: {
                    select: {
                        username: true,
                        wallet: true,
                        platform: true,
                    },
                },
            },
            take: 10000,
        }),
        prisma.levelProgress.findMany({
            where: {
                updatedAt: { gte: start, lte: end },
                user: userWhere,
            },
            select: { userId: true },
            distinct: ["userId"],
        }),
    ]);

    const playerMap = new Map<string, LevelProgressionPlayer>();
    const trackLeaders = new Map<LevelTrackKey, LevelProgressionPlayer>();

    for (const row of progressRows) {
        const existing = playerMap.get(row.userId);
        const updatedAt = existing && existing.updatedAt > row.updatedAt
            ? existing.updatedAt
            : row.updatedAt;
        const standardLevel = row.track === "STANDARD"
            ? row.level
            : existing?.standardLevel ?? null;
        const worldCupLevel = row.track === "WORLD_CUP"
            ? row.level
            : existing?.worldCupLevel ?? null;
        const highestLevel = Math.max(
            existing?.highestLevel ?? 0,
            row.level,
        );
        const player: LevelProgressionPlayer = {
            userId: row.userId,
            name: getDisplayName(row.user),
            platform: row.user.platform,
            highestLevel,
            standardLevel,
            worldCupLevel,
            updatedAt,
        };

        playerMap.set(row.userId, player);

        const track = row.track as LevelTrackKey;
        const currentLeader = trackLeaders.get(track);
        if (!currentLeader || row.level > (track === "STANDARD"
            ? currentLeader.standardLevel ?? 0
            : currentLeader.worldCupLevel ?? 0)) {
            trackLeaders.set(track, player);
        }
    }

    const players = Array.from(playerMap.values()).sort((a, b) =>
        b.highestLevel - a.highestLevel || b.updatedAt.getTime() - a.updatedAt.getTime()
    );
    const levelBuckets = [
        { range: "1-5", min: 1, max: 5 },
        { range: "6-10", min: 6, max: 10 },
        { range: "11-20", min: 11, max: 20 },
        { range: "21-30", min: 21, max: 30 },
        { range: "31-50", min: 31, max: 50 },
        { range: "51+", min: 51, max: Infinity },
    ].map(({ range, min, max }) => ({
        range,
        count: players.filter((player) => player.highestLevel >= min && player.highestLevel <= max).length,
    }));
    const totalHighestLevels = players.reduce((sum, player) => sum + player.highestLevel, 0);

    return {
        highestPlayer: players[0] ?? null,
        activeLevelers: activeLevelers.length,
        trackedPlayers: players.length,
        avgHighestLevel: players.length > 0 ? totalHighestLevels / players.length : 0,
        trackLeaders: {
            standard: trackLeaders.get("STANDARD") ?? null,
            worldCup: trackLeaders.get("WORLD_CUP") ?? null,
        },
        levelBuckets,
        topPlayers: players.slice(0, 10),
    };
}

// ============================================================
// PAGE COMPONENT
// ============================================================

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{
        range?: string;
        startDate?: string;
        endDate?: string;
        tab?: string;
        platform?: string;
        gameId?: string;
    }>;
}) {
    const { range, startDate, endDate, tab, platform, gameId } = await searchParams;
    const activeRange = range ?? "7d";
    const { start, end } = getDateRangeFromParam(activeRange, startDate, endDate);
    const validTabs: AnalyticsTab[] = ["overview", "games", "players"];
    const activeTab = validTabs.includes(tab as AnalyticsTab)
        ? (tab as AnalyticsTab)
        : "overview";
    const gameFilter = await getAnalyticsGameFilterData(platform, gameId);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-display">Analytics</h1>
                    <p className="text-sm text-white/60">
                        Track platform performance and user engagement
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker
                        currentRange={activeRange}
                        startDate={startDate}
                        endDate={endDate}
                    />
                </div>
            </div>

            <AnalyticsTabs currentTab={activeTab} />

            <AnalyticsGameFilter
                data={gameFilter}
                tab={activeTab}
                range={activeRange}
                startDate={startDate}
                endDate={endDate}
                platform={platform}
            />

            <Suspense fallback={<AnalyticsSkeleton />}>
                <AnalyticsContent
                    start={start}
                    end={end}
                    activeTab={activeTab}
                    platform={platform}
                    range={activeRange}
                    gameId={gameId}
                    gameFilter={gameFilter}
                />
            </Suspense>
        </div>
    );
}

async function AnalyticsContent({
    start,
    end,
    activeTab,
    platform,
    range,
    gameId,
    gameFilter,
}: {
    start: Date;
    end: Date;
    activeTab: AnalyticsTab;
    platform?: string;
    range: string;
    gameId?: string;
    gameFilter: AnalyticsGameFilterData;
}) {
    if (activeTab === "overview") {
        const [data, retention, onboarding] = await Promise.all([
            getCoreDashboard(start, end, platform, gameId, gameFilter),
            getRetentionData(start, end, platform, range, gameId),
            getOnboardingConversionData(start, end, platform),
        ]);
        return <OverviewTab data={data} retention={retention} onboarding={onboarding} />;
    }
    if (activeTab === "games") {
        const gameplay = await getGameplayData(start, end, platform, gameId, gameFilter);
        return <GameplayTab data={gameplay} />;
    }
    if (activeTab === "players") {
        const [revenue, retention, levels] = await Promise.all([
            getRevenueData(start, end, platform, gameId, gameFilter),
            getRetentionData(start, end, platform, range, gameId),
            getLevelProgressionData(start, end, platform),
        ]);
        return <RevenueRetentionTab revenue={revenue} retention={retention} levels={levels} />;
    }
    return null;
}

// ============================================================
// TAB: OVERVIEW (The "first dashboard")
// ============================================================

function OverviewTab({
    data,
    retention,
    onboarding,
}: {
    data: Awaited<ReturnType<typeof getCoreDashboard>>;
    retention: Awaited<ReturnType<typeof getRetentionData>>;
    onboarding: Awaited<ReturnType<typeof getOnboardingConversionData>>;
}) {
    return (
        <div className="space-y-6">
            {/* Primary KPIs — the 10 key metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard
                    title="Active Users"
                    value={data.activeUsers.toLocaleString()}
                    tooltip="Users whose last login falls inside the selected date range. This measures app activity, not just purchases."
                    change={{ value: data.activeUsersChange, isPositive: data.activeUsersChange >= 0 }}
                    icon={<UsersIcon className="h-5 w-5 text-[#00CFF2]" />}
                    subtitle={`${data.dau} DAU`}
                    glowVariant="cyan"
                />
                <KPICard
                    title="Onboarding Rate"
                    value={`${data.onboardingRate.toFixed(1)}%`}
                    tooltip="The share of users created in the selected range who reached game access or bought a ticket."
                    icon={<CheckCircleIcon className="h-5 w-5 text-[#14B985]" />}
                    subtitle="signup → onboarded"
                    glowVariant="success"
                />
                <KPICard
                    title="Purchase → Play"
                    value={`${data.purchaseToCompletionRate.toFixed(1)}%`}
                    tooltip="The share of purchased tickets that answered at least one question. This shows how many ticketed players actually engage after entry."
                    icon={<ArrowTrendingUpIcon className="h-5 w-5 text-[#FB72FF]" />}
                    subtitle={`${data.leaveRate.toFixed(1)}% leave rate`}
                    glowVariant="pink"
                />
                <KPICard
                    title="Activation Rate"
                    value={`${data.activationRate.toFixed(1)}%`}
                    tooltip="The share of users created in the selected range who bought their first ticket. This is signup-to-first-ticket activation, not retention."
                    icon={<FireIcon className="h-5 w-5 text-[#FFC931]" />}
                    subtitle="signup → first ticket"
                />
                <KPICard
                    title="Protocol Revenue"
                    value={`$${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    tooltip="Total protocol revenue recorded in the selected date range, calculated as the 20% fee on paid tickets."
                    change={{ value: data.entriesChange, isPositive: data.entriesChange >= 0 }}
                    icon={<BanknotesIcon className="h-5 w-5 text-[#FFC931]" />}
                    sparklineData={data.revenueSparkline}
                />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MiniStat label="Avg Score" value={data.avgScore.toFixed(0)} color="#FFC931" tooltip="Average final score across purchased ticket entries with answer data in the selected range." />
                <MiniStat label="Avg Answer Speed" value={`${(data.avgAnswerSpeed / 1000).toFixed(1)}s`} color="#00CFF2" tooltip="Average time taken to answer a question, based on stored per-answer latency in milliseconds." />
                <MiniStat label="Fee / Game" value={`$${data.revenuePerGame.toFixed(2)}`} color="#14B985" tooltip="Average protocol revenue generated per ended game in the selected range." />
                <MiniStat label="Claim Rate" value={`${data.claimRate.toFixed(1)}%`} color="#FB72FF" tooltip="The share of prize-winning entries that have already claimed their payouts." />
                <MiniStat label="DAU/WAU" value={`${retention.dauWauRatio.toFixed(0)}%`} color="#FFC931" tooltip="Daily active users divided by weekly active users. Higher values usually mean better short-term stickiness." />
            </div>

            <HourlyUserActivityChart data={data.hourlyUserActivity} />

            <OnboardingConversionPanel data={onboarding} />

            {/* Revenue chart */}
            <RevenueChart data={data.revenueChartData} />

            {/* Retention snapshot */}
            <div className="rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white font-display mb-4">Retention Snapshot</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[#00CFF2] font-body">{retention.dau}</div>
                        <div className="text-xs text-white/40 mt-1">DAU</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[#FFC931] font-body">{retention.wau}</div>
                        <div className="text-xs text-white/40 mt-1">WAU</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-[#FB72FF] font-body">{retention.mau}</div>
                        <div className="text-xs text-white/40 mt-1">MAU</div>
                    </div>
                </div>
                <div className="space-y-3">
                    <RetentionBar
                        label="New Players"
                        value={retention.newPlayers}
                        total={retention.playerBaseTotal}
                        color="#14B985"
                        tooltip={retention.isAllTime
                            ? "Lifetime signups for this platform."
                            : "Users created in the selected range who were also active during that same range."}
                    />
                    <RetentionBar
                        label="New Players With Ticket"
                        value={retention.newPlayersWithTicket}
                        total={retention.newPlayers}
                        color="#FB72FF"
                        tooltip={retention.isAllTime
                            ? "Lifetime signups who have ever bought at least one ticket."
                            : "New players created in the selected range who bought at least one ticket in that same range."}
                    />
                    <RetentionBar
                        label="Returning"
                        value={retention.returningPlayers}
                        total={retention.playerBaseTotal}
                        color="#00CFF2"
                        tooltip={retention.isAllTime
                            ? "Lifetime users who came back for more than one ticket."
                            : "Active users in the selected range who were created before that range started."}
                    />
                    <RetentionBar
                        label="Returning Players With Ticket"
                        value={retention.returningPlayersWithTicket}
                        total={retention.returningPlayers}
                        color="#14B985"
                        tooltip={retention.isAllTime
                            ? "Returning users who bought more than one ticket."
                            : "Returning players who bought at least one ticket in the selected range."}
                    />
                    <RetentionBar
                        label="Repeat Ticket Users"
                        value={retention.repeatBuyers}
                        total={retention.totalBuyers}
                        color="#FFC931"
                        tooltip="Unique users with more than one ticket in the selected range."
                    />
                </div>
            </div>

            {/* Game performance table */}
            <GamePerformanceTable games={data.gamePerformance} />
        </div>
    );
}

function OnboardingConversionPanel({
    data,
}: {
    data: Awaited<ReturnType<typeof getOnboardingConversionData>>;
}) {
    const maxUsers = Math.max(1, ...data.waitBuckets.map((bucket) => bucket.users));

    return (
        <section className="rounded-2xl border border-white/10 p-6">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white font-display">Onboarding Conversion</h3>
                    <p className="text-sm text-white/50">
                        Users who completed onboarding, then bought a paid ticket
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right">
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <div className="text-xs uppercase tracking-wider text-white/40">Completed</div>
                        <div className="mt-1 text-2xl font-bold text-[#00CFF2] font-body">
                            {data.completed.toLocaleString()}
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <div className="text-xs uppercase tracking-wider text-white/40">Bought Ticket</div>
                        <div className="mt-1 text-2xl font-bold text-[#14B985] font-body">
                            {data.ticketBuyerRate.toFixed(1)}%
                        </div>
                        <div className="mt-1 text-[11px] text-white/40">
                            {data.ticketBuyers.toLocaleString()} users
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-3">
                <OnboardingOutcomeStat
                    label="Bought Next Game"
                    value={`${data.nextGameBuyerRate.toFixed(1)}%`}
                    detail={`${data.nextGameBuyers.toLocaleString()} users`}
                    color="#00CFF2"
                />
                <OnboardingOutcomeStat
                    label="Bought Later Game"
                    value={`${data.laterGameBuyerRate.toFixed(1)}%`}
                    detail={`${data.laterGameBuyers.toLocaleString()} users`}
                    color="#FFC931"
                />
                <OnboardingOutcomeStat
                    label="No Upcoming Game"
                    value={`${data.noUpcomingGame.conversionRate.toFixed(1)}%`}
                    detail={`${data.noUpcomingGame.users.toLocaleString()} users`}
                    color="#14B985"
                />
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/8">
                <div className="grid grid-cols-[minmax(78px,0.8fr)_minmax(120px,1.5fr)_minmax(82px,0.8fr)_minmax(92px,0.8fr)] gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3 text-xs font-medium uppercase tracking-wider text-white/40">
                    <span>Wait</span>
                    <span>Onboarded Users</span>
                    <span>Buyers</span>
                    <span>Conversion</span>
                </div>
                <div className="divide-y divide-white/8">
                    {data.waitBuckets.map((bucket) => (
                        <div
                            key={bucket.label}
                            className="grid grid-cols-[minmax(78px,0.8fr)_minmax(120px,1.5fr)_minmax(82px,0.8fr)_minmax(92px,0.8fr)] items-center gap-3 px-4 py-3 text-sm"
                        >
                            <span className="font-body text-white">{bucket.label}</span>
                            <div className="flex items-center gap-3">
                                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div
                                        className="h-full rounded-full bg-[#00CFF2]"
                                        style={{ width: `${(bucket.users / maxUsers) * 100}%` }}
                                    />
                                </div>
                                <span className="w-12 text-right text-white/60">{bucket.users}</span>
                            </div>
                            <span className="text-white/70">{bucket.nextGameBuyers}</span>
                            <span className="font-body text-[#14B985]">
                                {bucket.conversionRate.toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {data.noUpcomingGame.users > 0 ? (
                <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                    {data.noUpcomingGame.users.toLocaleString()} onboarded users had no upcoming production game in the tracked schedule;
                    {" "}
                    {data.noUpcomingGame.conversionRate.toFixed(1)}% later bought any paid ticket.
                </div>
            ) : null}

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <OnboardingDiagnosticTable
                    title="Traffic Source"
                    rows={data.diagnostics.platform}
                    labelHeader="Platform"
                />
                <OnboardingDiagnosticTable
                    title="Referral"
                    rows={data.diagnostics.referral}
                    labelHeader="Source"
                />
                <OnboardingDiagnosticTable
                    title="Reminder Channel"
                    rows={data.diagnostics.notifications}
                    labelHeader="State"
                />
                <OnboardingDiagnosticTable
                    title="Game Reminder Readiness"
                    rows={data.diagnostics.nextGameReminders}
                    labelHeader="State"
                />
                <OnboardingDiagnosticTable
                    title="First Upcoming Game Theme"
                    rows={data.diagnostics.nextGameTheme}
                    labelHeader="Theme"
                />
                <OnboardingDiagnosticTable
                    title="First Upcoming Game Price"
                    rows={data.diagnostics.nextGamePrice}
                    labelHeader="Price"
                />
                <OnboardingDiagnosticTable
                    title="First Upcoming Game Start"
                    rows={data.diagnostics.nextGameStartHour}
                    labelHeader="Hour"
                />
                <OnboardingDiagnosticTable
                    title="Purchase Path"
                    rows={data.diagnostics.purchasePath}
                    labelHeader="Outcome"
                    showNextGameConversion={false}
                />
            </div>
        </section>
    );
}

function OnboardingOutcomeStat({
    label,
    value,
    detail,
    color,
}: {
    label: string;
    value: string;
    detail: string;
    color: string;
}) {
    return (
        <div className="border-t border-white/8 pt-3">
            <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
            <div className="mt-1 text-xl font-bold font-body" style={{ color }}>
                {value}
            </div>
            <div className="mt-1 text-[11px] text-white/40">{detail}</div>
        </div>
    );
}

function OnboardingDiagnosticTable({
    title,
    rows,
    labelHeader,
    showNextGameConversion = true,
}: {
    title: string;
    rows: OnboardingDiagnosticSegment[];
    labelHeader: string;
    showNextGameConversion?: boolean;
}) {
    const grid = showNextGameConversion
        ? "grid-cols-[minmax(88px,1.2fr)_64px_72px_72px]"
        : "grid-cols-[minmax(88px,1.2fr)_64px_72px]";

    return (
        <div className="min-w-0 border-t border-white/8 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-white font-display">{title}</h4>
            <div className="overflow-hidden rounded-xl border border-white/8">
                <div className={`grid ${grid} gap-2 border-b border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/40`}>
                    <span>{labelHeader}</span>
                    <span className="text-right">Users</span>
                    <span className="text-right">Any Buy</span>
                    {showNextGameConversion ? <span className="text-right">Next Buy</span> : null}
                </div>
                <div className="divide-y divide-white/8">
                    {rows.map((row) => (
                        <div key={row.label} className={`grid ${grid} items-center gap-2 px-3 py-2 text-xs`}>
                            <span className="truncate text-white/70">{row.label}</span>
                            <span className="text-right text-white/60">{row.users.toLocaleString()}</span>
                            <span className="text-right font-body text-[#14B985]">{row.conversionRate.toFixed(1)}%</span>
                            {showNextGameConversion ? (
                                <span className="text-right font-body text-[#00CFF2]">
                                    {(row.nextGameConversionRate ?? 0).toFixed(1)}%
                                </span>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// TAB: GAMEPLAY QUALITY
// ============================================================

function GameFilterLink({
    href,
    active,
    children,
}: {
    href: string;
    active: boolean;
    children: React.ReactNode;
}) {
    return (
        <Link
            href={href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active
                ? "bg-[#FFC931] text-black shadow-sm shadow-[#FFC931]/20"
                : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                }`}
        >
            {children}
        </Link>
    );
}

function AnalyticsGameFilter({
    data,
    tab,
    range,
    startDate,
    endDate,
    platform,
}: {
    data: AnalyticsGameFilterData;
    tab: AnalyticsTab;
    range: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
}) {
    const { selectedGameId, selectedGame, currentGame, previousGame, options } = data;

    return (
        <div className="rounded-2xl border border-white/10 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-white font-display">Game Filter</h3>
                    <p className="mt-1 text-xs text-white/50">
                        {selectedGame
                            ? `${selectedGame.title} · ${formatGameDateTime(selectedGame.startsAt)}`
                            : "All games in the selected date range"}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <GameFilterLink
                        href={buildAnalyticsFilterHref({ tab, range, startDate, endDate, platform })}
                        active={!selectedGameId}
                    >
                        All games
                    </GameFilterLink>
                    {currentGame ? (
                        <GameFilterLink
                            href={buildAnalyticsFilterHref({ tab, range, startDate, endDate, platform, gameId: currentGame.id })}
                            active={selectedGameId === currentGame.id}
                        >
                            Current
                        </GameFilterLink>
                    ) : null}
                    {previousGame ? (
                        <GameFilterLink
                            href={buildAnalyticsFilterHref({ tab, range, startDate, endDate, platform, gameId: previousGame.id })}
                            active={selectedGameId === previousGame.id}
                        >
                            Previous
                        </GameFilterLink>
                    ) : null}
                </div>
            </div>

            <form action="/admin/analytics" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="tab" value={tab} />
                <input type="hidden" name="range" value={range} />
                {range === "custom" && startDate ? <input type="hidden" name="startDate" value={startDate} /> : null}
                {range === "custom" && endDate ? <input type="hidden" name="endDate" value={endDate} /> : null}
                {platform ? <input type="hidden" name="platform" value={platform} /> : null}
                <select
                    name="gameId"
                    defaultValue={selectedGameId ?? ""}
                    className="h-10 rounded-lg border border-white/10 bg-[#141414] px-3 text-sm text-white outline-none focus:border-[#FFC931]/60"
                >
                    <option value="">All games in range</option>
                    {options.map((game: AnalyticsGameFilterOption) => (
                        <option key={game.id} value={game.id}>
                            {game.title} · {formatGameDateTime(game.startsAt)} · {game.playerCount} players
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="h-10 rounded-lg bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                    Apply
                </button>
            </form>
        </div>
    );
}

function GameplayTab({ data }: { data: Awaited<ReturnType<typeof getGameplayData>> }) {
    return (
        <div className="space-y-6">
            {/* Top-line gameplay KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                <MiniStat label="Accuracy" value={`${data.avgAccuracy.toFixed(1)}%`} color="#14B985" tooltip="Correct answers divided by all submitted answers in the selected range." />
                <MiniStat label="Avg Speed" value={`${(data.avgAnswerTime / 1000).toFixed(1)}s`} color="#00CFF2" tooltip="Average answer latency across all tracked answers in the selected range." />
                <MiniStat label="Completion" value={`${data.completionRate.toFixed(1)}%`} color="#FFC931" tooltip="The share of paid entries that submitted at least one answer." />
                <MiniStat label="Leave Rate" value={`${data.leaveRate.toFixed(1)}%`} color="#EF4444" tooltip="The share of paid entries that left the game before the session was over." />
                <MiniStat label="Win Rate" value={`${data.winRate.toFixed(2)}%`} color="#FB72FF" tooltip="Rank-1 finishes divided by all ranked paid entries in the selected range." />
                <MiniStat label="Avg Score" value={data.avgScore.toFixed(0)} color="#FFC931" tooltip="Average score across the paid entries included in gameplay analysis." />
                <MiniStat label="Answered / Last 5" value={data.answeredPlayersAcrossLastFiveGames.toLocaleString()} color="#14B985" tooltip="Unique ticket buyers who answered at least one question across the latest 5 ended games." />
            </div>

            <div className="rounded-2xl border border-white/10 p-6 space-y-6">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Current Ticket Buyers</h3>
                        <p className="text-sm text-white/50">
                            Repeat and first-time buyer signals for the current ticket-selling game
                        </p>
                    </div>
                    {data.currentTicketBuyers ? (
                        <div className="text-right text-xs text-white/40">
                            <div>{data.currentTicketBuyers.currentGameTitle}</div>
                            <div>vs {data.currentTicketBuyers.previousGameTitle}</div>
                        </div>
                    ) : null}
                </div>

                {data.currentTicketBuyers ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <MiniStat label="Current Buyers" value={data.currentTicketBuyers.buyers.count.toLocaleString()} color="#FFC931" tooltip="Current ticket buyers in the live or next game." />
                        <MiniStat label="Played Last Game" value={`${data.currentTicketBuyers.buyers.playedLastGameRate.toFixed(1)}%`} color="#14B985" tooltip="Current ticket buyers who answered at least one question in the previous comparable game." />
                        <MiniStat label="Bought Last Game" value={`${data.currentTicketBuyers.buyers.boughtLastGameRate.toFixed(1)}%`} color="#00CFF2" tooltip="Current ticket buyers who also bought a ticket in the previous comparable game." />
                        <MiniStat label="First Ticket Ever" value={`${data.currentTicketBuyers.buyers.firstTimeRate.toFixed(1)}%`} color="#FB72FF" tooltip="Current ticket buyers with no earlier ticket history." />
                    </div>
                ) : (
                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 text-sm text-white/50">
                        No live or upcoming game pair is available yet for current-ticket buyer analytics.
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-white/10 p-6 space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-white font-display">Entry Source Comparison</h3>
                    <p className="text-sm text-white/50">
                        Tournament purchases attributed to Home vs the post-level upsell
                    </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-white/8">
                    <div className="grid grid-cols-[minmax(120px,1fr)_72px_72px_88px_88px_88px] gap-3 border-b border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                        <span>Source</span>
                        <span className="text-right">Buys</span>
                        <span className="text-right">Buyers</span>
                        <span className="text-right">Revenue</span>
                        <span className="text-right">Started</span>
                        <span className="text-right">No-show</span>
                    </div>
                    <div className="divide-y divide-white/8">
                        {data.entrySourceComparison.map((source) => (
                            <div key={source.source} className="grid grid-cols-[minmax(120px,1fr)_72px_72px_88px_88px_88px] items-center gap-3 px-3 py-3 text-xs">
                                <span className="truncate font-medium text-white/75">{source.label}</span>
                                <span className="text-right font-body text-[#FFC931]">{source.purchases.toLocaleString()}</span>
                                <span className="text-right text-white/60">{source.buyers.toLocaleString()}</span>
                                <span className="text-right font-body text-[#14B985]">${source.revenue.toFixed(2)}</span>
                                <span className="text-right font-body text-[#00CFF2]">{source.startRate.toFixed(1)}%</span>
                                <span className="text-right font-body text-[#FB72FF]">{source.noShowRate.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Behavior Signals */}
            <div className="rounded-2xl border border-white/10 p-6 space-y-6">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Behavior Signals</h3>
                        <p className="text-sm text-white/50">
                            No-shows, late joins, and answer quality signals that explain how the lobby really behaved
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniStat
                        label="No-Show"
                        value={`${data.behavior.tickets.noShowRate.toFixed(1)}%`}
                        color="#FFC931"
                        tooltip="Ticket buyers who never answered a question."
                    />
                    <MiniStat
                        label="Late Entry Rate"
                        value={`${data.behavior.lateEntry.rate.toFixed(1)}%`}
                        color="#FB72FF"
                        tooltip="Entries created after the scheduled game start."
                    />
                    <MiniStat
                        label="Started Q1"
                        value={`${data.behavior.startLine.startRate.toFixed(1)}%`}
                        color="#14B985"
                        tooltip="Share of ticketed entries that answered the first question in their game."
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Ticket Outcomes</h4>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-xl bg-[#FFC931]/10 border border-[#FFC931]/20 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/50">Tickets</div>
                                <div className="mt-2 text-2xl font-bold text-[#FFC931] font-body">{data.behavior.tickets.entries}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.tickets.completedAll} finished
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#00CFF2]/10 border border-[#00CFF2]/20 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/50">Partial</div>
                                <div className="mt-2 text-2xl font-bold text-[#00CFF2] font-body">{data.behavior.tickets.partial}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    answered some questions
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#FB72FF]/10 border border-[#FB72FF]/20 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/50">No-Show Revenue</div>
                                <div className="mt-2 text-2xl font-bold text-[#FB72FF] font-body">
                                    ${data.behavior.monetization.noShowRevenue.toFixed(2)}
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.monetization.noShowRevenueRate.toFixed(1)}% of ticket revenue
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2 text-sm text-white/60">
                            <div className="flex items-center justify-between">
                                <span>Partial runs</span>
                                <span className="font-body text-white">{data.behavior.tickets.partial}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>No-shows</span>
                                <span className="font-body text-white">{data.behavior.tickets.noShow}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Completed all questions</span>
                                <span className="font-body text-white">{data.behavior.tickets.completedAll}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Late Join Pressure</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Late entries</div>
                                <div className="mt-2 text-2xl font-bold text-[#FB72FF] font-body">{data.behavior.lateEntry.entries}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.lateEntry.played} played, {data.behavior.lateEntry.noShows} no-showed
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Late leaderboard impact</div>
                                <div className="mt-2 text-2xl font-bold text-[#FFC931] font-body">{data.behavior.lateEntry.top10}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    top 10 finishes, {data.behavior.lateEntry.top3} in top 3
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 rounded-xl bg-white/5 border border-white/8 p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/60">Ticket buyers in top 10</span>
                                <span className="font-body text-[#FFC931]">{data.behavior.leaderboard.ticketTop10}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Start-Line Friction</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Answered Q1</div>
                                <div className="mt-2 text-2xl font-bold text-[#14B985] font-body">{data.behavior.startLine.started}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.startLine.startRate.toFixed(1)}% of ticketed entries
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Reached final question</div>
                                <div className="mt-2 text-2xl font-bold text-[#00CFF2] font-body">{data.behavior.startLine.reachedFinalQuestion}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.startLine.finishRateAfterStart.toFixed(1)}% of starters
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Answer Quality</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Accuracy</div>
                                <div className="mt-2 text-xl font-bold text-[#14B985] font-body">
                                    {data.behavior.answerQuality.accuracy.toFixed(1)}%
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    correct answers
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Avg speed</div>
                                <div className="mt-2 text-xl font-bold text-[#00CFF2] font-body">
                                    {(data.behavior.answerQuality.avgResponseMs / 1000).toFixed(1)}s
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    per answer
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Points / answer</div>
                                <div className="mt-2 text-xl font-bold text-[#FFC931] font-body">
                                    {data.behavior.answerQuality.avgPointsPerAnswer.toFixed(0)}
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    average points
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Score + Rank Distribution */}
            <PlayerEngagement
                data={{
                    avgScore: data.avgScore,
                    avgAccuracy: data.avgAccuracy,
                    avgAnswerTime: data.avgAnswerTime,
                    scoreDistribution: data.scoreDistribution,
                    totalPlayers: data.totalPlayers,
                    repeatPlayers: 0,
                }}
            />

            {/* Rank Distribution */}
            <div className="rounded-2xl border border-white/10 p-6">
                <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Placement Distribution</h3>
                        <p className="text-sm text-white/50">
                            Share of ranked entries finishing in each leaderboard bucket
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white font-body">
                            {data.totalRankedEntries}
                        </div>
                        <div className="text-xs text-white/40">ranked entries</div>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {data.rankDistribution.map((bucket) => (
                        <div key={bucket.range} className="rounded-xl bg-white/5 border border-white/8 p-4 text-center">
                            <div className="text-xl font-bold text-[#FFC931] font-body">
                                {bucket.percentage.toFixed(1)}%
                            </div>
                            <div className="text-xs text-white/40 mt-1">{bucket.range}</div>
                            <div className="mt-1 text-[11px] text-white/30">
                                {bucket.count} entries
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Theme Participation */}
            <div className="rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white font-display mb-4">Theme Participation</h3>
                <div className="space-y-3">
                    {data.themeParticipation.map((t) => (
                        <div key={t.theme} className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-white capitalize">{t.theme.toLowerCase()}</span>
                                <span className="text-xs text-white/40">{t.games} games</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-[#00CFF2]">{t.players} players</span>
                                <span className="text-sm text-[#FFC931]">${(t.avgPrizePool).toFixed(0)} avg pool</span>
                            </div>
                        </div>
                    ))}
                    {data.themeParticipation.length === 0 && (
                        <div className="text-center py-8 text-white/40">No theme data yet</div>
                    )}
                </div>
            </div>

            {/* Question Difficulty */}
            <QuestionDifficulty questions={data.questions} />
        </div>
    );
}

// ============================================================
// TAB: REVENUE & RETENTION
// ============================================================

function RevenueRetentionTab({
    revenue,
    retention,
    levels,
}: {
    revenue: Awaited<ReturnType<typeof getRevenueData>>;
    retention: Awaited<ReturnType<typeof getRetentionData>>;
    levels: Awaited<ReturnType<typeof getLevelProgressionData>>;
}) {
    return (
        <div className="space-y-6">
            {/* Revenue KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    title="Protocol Revenue"
                    value={`$${revenue.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    tooltip="Total protocol revenue in the selected date range, calculated as the 20% fee on paid tickets."
                    change={{ value: revenue.revenueChange, isPositive: revenue.revenueChange >= 0 }}
                    icon={<BanknotesIcon className="h-5 w-5 text-[#FFC931]" />}
                    sparklineData={revenue.sparkline}
                />
                <KPICard
                    title="Tickets Sold"
                    value={revenue.totalEntries.toLocaleString()}
                    tooltip="Count of paid ticket entries recorded in the selected date range."
                    change={{ value: revenue.entriesChange, isPositive: revenue.entriesChange >= 0 }}
                    icon={<TrophyIcon className="h-5 w-5 text-[#00CFF2]" />}
                    glowVariant="cyan"
                />
                <KPICard
                    title="Fee / Active User"
                    value={`$${revenue.revenuePerActiveUser.toFixed(2)}`}
                    tooltip="Protocol revenue divided by unique buyers in the selected range."
                    icon={<UserGroupIcon className="h-5 w-5 text-[#14B985]" />}
                    subtitle={`Fee LTV: $${revenue.lifetimeRevenuePerUser.toFixed(2)}`}
                    glowVariant="success"
                />
                <KPICard
                    title="Claim Rate"
                    value={`${revenue.claimRate.toFixed(1)}%`}
                    tooltip="The share of prize-winning entries in the selected range that have already claimed their rewards."
                    icon={<CurrencyDollarIcon className="h-5 w-5 text-[#FB72FF]" />}
                    subtitle={`$${(revenue.unclaimedPrizes).toFixed(2)} unclaimed`}
                    glowVariant="pink"
                />
            </div>

            {/* Revenue detail stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Avg Ticket" value={`$${revenue.avgTicketAmount.toFixed(2)}`} color="#FFC931" tooltip="Average paid ticket amount across all paid entries in the selected range." />
                <MiniStat label="Tickets / User" value={revenue.ticketsPerUser.toFixed(1)} color="#00CFF2" tooltip="Average number of paid tickets bought per unique buyer in the selected range." />
                <MiniStat label="Prizes Awarded" value={`$${revenue.totalPrizesAwarded.toFixed(2)}`} color="#14B985" tooltip="Total prize value assigned to winners in the selected range." />
                <MiniStat label="Prizes Claimed" value={`$${revenue.totalPrizesClaimed.toFixed(2)}`} color="#FB72FF" tooltip="Total prize value already claimed by winners in the selected range." />
            </div>

            {/* Revenue chart */}
            <RevenueChart data={revenue.chartData} />

            {/* Top games by revenue */}
            <GamePerformanceTable games={revenue.topGames} />

            <LevelProgressionPanel data={levels} />

            {/* Retention deep-dive */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Streak distribution */}
                <div className="rounded-2xl border border-white/10 p-6">
                    <h3 className="text-lg font-semibold text-white font-display mb-4">Login Streak Distribution</h3>
                    <div className="space-y-3">
                        {retention.streakDistribution.map((bucket) => {
                            const maxCount = Math.max(...retention.streakDistribution.map((b) => b.count), 1);
                            const widthPct = (bucket.count / maxCount) * 100;
                            return (
                                <div key={bucket.range} className="flex items-center gap-3">
                                    <span className="text-sm text-white/60 w-12 text-right font-display">{bucket.range}</span>
                                    <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                                        <div
                                            className="h-full rounded-lg bg-[#FFC931]/30"
                                            style={{ width: `${Math.max(widthPct, 2)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-white/80 w-10 font-body">{bucket.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Days since last session */}
                <div className="rounded-2xl border border-white/10 p-6">
                    <h3 className="text-lg font-semibold text-white font-display mb-4">Days Since Last Session</h3>
                    <div className="space-y-3">
                        {retention.daysSinceLastSession.map((bucket) => {
                            const maxCount = Math.max(...retention.daysSinceLastSession.map((b) => b.count), 1);
                            const widthPct = (bucket.count / maxCount) * 100;
                            return (
                                <div key={bucket.range} className="flex items-center gap-3">
                                    <span className="text-sm text-white/60 w-14 text-right font-display">{bucket.range}</span>
                                    <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden">
                                        <div
                                            className="h-full rounded-lg bg-[#00CFF2]/30"
                                            style={{ width: `${Math.max(widthPct, 2)}%` }}
                                        />
                                    </div>
                                    <span className="text-sm text-white/80 w-10 font-body">{bucket.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function formatLevelTrack(track: LevelTrackKey) {
    return track === "WORLD_CUP" ? "World Cup" : "Standard";
}

function LevelLeaderCard({
    title,
    player,
    level,
    color,
}: {
    title: string;
    player: LevelProgressionPlayer | null;
    level: number | null;
    color: string;
}) {
    return (
        <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
            <div className="text-xs uppercase tracking-wider text-white/40">{title}</div>
            <div className="mt-3 text-2xl font-bold font-body" style={{ color }}>
                {level ? `Level ${level}` : "No data"}
            </div>
            <div className="mt-1 truncate text-sm text-white/65">
                {player ? `${player.name} · ${player.platform}` : "No player yet"}
            </div>
        </div>
    );
}

function LevelProgressionPanel({
    data,
}: {
    data: Awaited<ReturnType<typeof getLevelProgressionData>>;
}) {
    const maxBucketCount = Math.max(...data.levelBuckets.map((bucket) => bucket.count), 1);

    return (
        <div className="rounded-2xl border border-white/10 p-6 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white font-display">Level Progression</h3>
                    <p className="text-sm text-white/50">
                        Current level leaders and progression depth across solo tracks
                    </p>
                </div>
                {data.highestPlayer ? (
                    <div className="text-right">
                        <div className="text-xs uppercase tracking-wider text-white/40">Highest current level</div>
                        <div className="mt-1 text-2xl font-bold text-[#FFC931] font-body">
                            {data.highestPlayer.name} · Level {data.highestPlayer.highestLevel}
                        </div>
                    </div>
                ) : null}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="Highest Level" value={(data.highestPlayer?.highestLevel ?? 0).toLocaleString()} color="#FFC931" tooltip="Highest current level on any solo progression track." />
                <MiniStat label="Tracked Players" value={data.trackedPlayers.toLocaleString()} color="#00CFF2" tooltip="Non-banned players with at least one LevelProgress row." />
                <MiniStat label="Leveled In Range" value={data.activeLevelers.toLocaleString()} color="#14B985" tooltip="Unique players whose level progress changed inside the selected date range." />
                <MiniStat label="Avg High Level" value={data.avgHighestLevel.toFixed(1)} color="#FB72FF" tooltip="Average of each tracked player's highest current level across tracks." />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <LevelLeaderCard
                        title={`${formatLevelTrack("STANDARD")} leader`}
                        player={data.trackLeaders.standard}
                        level={data.trackLeaders.standard?.standardLevel ?? null}
                        color="#FFC931"
                    />
                    <LevelLeaderCard
                        title={`${formatLevelTrack("WORLD_CUP")} leader`}
                        player={data.trackLeaders.worldCup}
                        level={data.trackLeaders.worldCup?.worldCupLevel ?? null}
                        color="#00CFF2"
                    />
                </div>

                <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                    <h4 className="text-sm font-semibold text-white font-display mb-4">Highest Level Distribution</h4>
                    <div className="space-y-3">
                        {data.levelBuckets.map((bucket) => {
                            const widthPct = (bucket.count / maxBucketCount) * 100;
                            return (
                                <div key={bucket.range} className="flex items-center gap-3">
                                    <span className="w-12 text-right text-sm text-white/55 font-display">{bucket.range}</span>
                                    <div className="h-6 flex-1 overflow-hidden rounded-lg bg-white/5">
                                        <div
                                            className="h-full rounded-lg bg-[#14B985]/30"
                                            style={{ width: `${Math.max(widthPct, bucket.count > 0 ? 3 : 0)}%` }}
                                        />
                                    </div>
                                    <span className="w-10 text-sm text-white/80 font-body">{bucket.count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/8">
                <div className="grid min-w-[560px] grid-cols-[minmax(140px,1fr)_90px_80px_80px_110px] gap-3 border-b border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                    <span>Player</span>
                    <span>Platform</span>
                    <span className="text-right">Standard</span>
                    <span className="text-right">World Cup</span>
                    <span className="text-right">Highest</span>
                </div>
                <div className="divide-y divide-white/8">
                    {data.topPlayers.map((player) => (
                        <div key={player.userId} className="grid min-w-[560px] grid-cols-[minmax(140px,1fr)_90px_80px_80px_110px] items-center gap-3 px-3 py-3 text-xs">
                            <span className="truncate font-medium text-white/75">{player.name}</span>
                            <span className="text-white/50">{player.platform}</span>
                            <span className="text-right font-body text-[#FFC931]">{player.standardLevel ?? "-"}</span>
                            <span className="text-right font-body text-[#00CFF2]">{player.worldCupLevel ?? "-"}</span>
                            <span className="text-right font-body text-[#14B985]">Level {player.highestLevel}</span>
                        </div>
                    ))}
                    {data.topPlayers.length === 0 ? (
                        <div className="px-3 py-5 text-sm text-white/50">No level progress recorded yet.</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function MiniStat({
    label,
    value,
    color,
    tooltip,
}: {
    label: string;
    value: string;
    color: string;
    tooltip?: string;
}) {
    return (
        <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.02]">
            <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 font-display">
                <span>{label}</span>
                {tooltip ? <MetricTooltip content={tooltip} /> : null}
            </div>
            <div className="text-xl font-bold font-body" style={{ color }}>{value}</div>
        </div>
    );
}

function RetentionBar({
    label,
    value,
    total,
    color,
    tooltip,
    segments,
}: {
    label: string;
    value: number;
    total: number;
    color: string;
    tooltip?: string;
    segments?: Array<{ value: number; color: string; label: string }>;
}) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    const visibleSegments = (segments || []).filter((segment) => segment.value > 0);
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm text-white/60 font-display">
                    <span>{label}</span>
                    {tooltip ? <MetricTooltip content={tooltip} /> : null}
                </span>
                <span className="text-sm font-body" style={{ color }}>{value} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                {visibleSegments.length > 0 ? (
                    <div className="h-full flex" style={{ width: `${Math.max(pct, 1)}%` }}>
                        {visibleSegments.map((segment) => {
                            const segmentPct = value > 0 ? (segment.value / value) * 100 : 0;
                            return (
                                <div
                                    key={segment.label}
                                    className="h-full"
                                    style={{ width: `${segmentPct}%`, backgroundColor: segment.color }}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }} />
                )}
            </div>
            {visibleSegments.length > 0 ? (
                <div className="mt-2 flex items-center gap-4 text-[11px] text-white/45">
                    {visibleSegments.map((segment) => (
                        <span key={segment.label} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
                            <span>{segment.label}: {segment.value}</span>
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function AnalyticsSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-32 bg-white/5 border border-white/10 rounded-2xl" />
                ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-white/5 border border-white/10 rounded-2xl" />
                ))}
            </div>
            <div className="h-80 bg-white/5 border border-white/10 rounded-2xl" />
        </div>
    );
}
