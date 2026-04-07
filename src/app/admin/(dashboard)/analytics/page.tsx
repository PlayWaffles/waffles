import { prisma } from "@/lib/db";
import { Suspense } from "react";
import {
    BanknotesIcon,
    UsersIcon,
    TrophyIcon,
    ChartBarIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
    FireIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
    BoltIcon,
    CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
    DateRangePicker,
    getDateRangeFromParam,
    KPICard,
    RevenueChart,
    UserGrowthChart,
    GamePerformanceTable,
    ReferralFunnel,
    ActivityFeed,
    GameInsights,
    QuestionDifficulty,
    PlayerEngagement,
    ChatAnalytics,
    AnalyticsTabs,
    MetricTooltip,
    type AnalyticsTab,
} from "@/components/admin/analytics";
import { PlatformFilter } from "@/components/admin/PlatformFilter";
import { getGamePhase } from "@/lib/types";
import {
    buildPlatformWhere,
    buildProductionEntryWhere,
    buildProductionGameWhere,
    calculateProtocolRevenue,
} from "@/lib/admin-utils";
import { getStoredChatHistory } from "@/lib/partykit";
import { TicketPurchaseSource } from "@prisma";

// ============================================================
// HELPERS
// ============================================================

interface AnswerData {
    selected: number;
    correct: boolean;
    points: number;
    ms: number;
}

const CHAT_STOPWORDS = new Set([
    "the", "and", "for", "that", "this", "with", "you", "your", "are", "was",
    "have", "has", "not", "but", "all", "just", "can", "get", "out", "how",
    "what", "when", "why", "who", "will", "from", "into", "they", "them", "their",
    "our", "about", "was", "were", "too", "very", "then", "than", "its", "it's",
    "im", "i'm", "ive", "i've", "dont", "don't", "cant", "can't", "lets", "let's",
    "yeah", "nah", "lol", "lfg", "omg", "pls", "please", "rt", "amp", "http", "https",
    "www", "com", "game", "waffles",
]);

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

const FREE_TICKET_SOURCES = [
    TicketPurchaseSource.FREE_ADMIN,
    TicketPurchaseSource.FREE_PLAYER,
] as const;

function buildClaimedTicketWhere(
    start: Date,
    end: Date,
    gpf: Record<string, unknown>,
) {
    return {
        ...gpf,
        OR: [
            { paidAt: { not: null, gte: start, lte: end } },
            {
                purchaseSource: { in: [...FREE_TICKET_SOURCES] },
                createdAt: { gte: start, lte: end },
            },
        ],
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

// ============================================================
// 1. CORE DASHBOARD (The "first dashboard" metrics)
// ============================================================

async function getCoreDashboard(start: Date, end: Date, platform?: string) {
    const now = new Date();
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const pf = buildPlatformWhere(platform);
    const gamePf = buildProductionGameWhere(platform);
    const gpf = buildProductionEntryWhere(platform);
    const claimedTicketWhere = buildClaimedTicketWhere(start, end, gpf);
    const previousClaimedTicketWhere = buildClaimedTicketWhere(previousStart, start, gpf);

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
        totalGamesInPeriod,
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
        // Games in period
        prisma.game.count({ where: { ...gamePf, startsAt: { gte: start, lte: end } } }),
        // Total entries (ticket purchases) in period
        prisma.gameEntry.count({ where: claimedTicketWhere }),
        // Previous period entries
        prisma.gameEntry.count({ where: previousClaimedTicketWhere }),
        // Completed entries (answered at least 1 question)
        prisma.gameEntry.count({ where: { ...claimedTicketWhere, answered: { gt: 0 } } }),
        // Left entries
        prisma.gameEntry.count({ where: { ...claimedTicketWhere, leftAt: { not: null } } }),
        // D1: new users in period who also have an entry
        prisma.user.count({
            where: {
                ...pf,
                createdAt: { gte: start, lte: end },
                entries: { some: { game: gamePf } },
            },
        }),
        // Average score
        prisma.gameEntry.aggregate({
            where: { ...claimedTicketWhere, answered: { gt: 0 } },
            _avg: { score: true },
        }),
        // Entries with answers for speed computation
        prisma.gameEntry.findMany({
            where: { ...claimedTicketWhere, answered: { gt: 0 } },
            select: { answers: true },
            take: 5000,
        }),
        // Total prizes awarded
        prisma.gameEntry.count({ where: { prize: { not: null, gt: 0 }, ...gpf, paidAt: { gte: start, lte: end } } }),
        // Claimed prizes
        prisma.gameEntry.count({ where: { claimedAt: { not: null }, prize: { gt: 0 }, ...gpf, paidAt: { gte: start, lte: end } } }),
        // Daily signups for sparkline
        prisma.user.groupBy({
            by: ["createdAt"],
            where: { ...pf, createdAt: { gte: start, lte: end } },
            _count: true,
        }),
        // Revenue entries for sparkline + summaries
        prisma.gameEntry.findMany({
            where: { paidAt: { not: null, gte: start, lte: end }, ...gpf },
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
            where: { ...claimedTicketWhere, answered: { gt: 0 } },
            _avg: { score: true },
        }),
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
    const revenueSparkline = Array.from(revenueMap.values()).slice(-7);
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
    const revenueChartData = sortedRevenueDates.map((date) => ({
        date: date.slice(5),
        revenue: revenueMap.get(date) || 0,
        tickets: ticketMap.get(date) || 0,
    }));

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
        // Game performance table
        gamePerformance: attachAverageScores(gamesWithRevenue, gameScoreAverages),
    };
}

// ============================================================
// 2. RETENTION ANALYTICS
// ============================================================

async function getRetentionData(start: Date, end: Date, platform?: string) {
    const now = new Date();
    const pf = buildPlatformWhere(platform);
    const gpf = buildProductionEntryWhere(platform);

    const [
        // DAU / WAU / MAU
        dauUsers,
        wauUsers,
        mauUsers,
        // New vs returning in period
        newPlayersInPeriod,
        totalPlayersInPeriod,
        newPlayersWithEntries,
        // Streak distribution
        streakDistribution,
        // Ticket users in period for free vs paid breakdowns
        entriesInPeriod,
        // Users with last session info
        usersWithLastEntry,
    ] = await Promise.all([
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
        prisma.user.count({
            where: {
                ...pf,
                createdAt: { gte: start, lte: end },
                entries: { some: { createdAt: { gte: start, lte: end }, ...gpf } },
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
            where: { createdAt: { gte: start, lte: end }, ...gpf },
            select: {
                userId: true,
                purchaseSource: true,
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
        hasPaid: boolean;
        createdAt: Date;
    }>();

    entriesInPeriod.forEach((entry) => {
        const existing = entryUsers.get(entry.userId) ?? {
            entryCount: 0,
            hasPaid: false,
            createdAt: entry.user.createdAt,
        };
        existing.entryCount += 1;
        if (entry.purchaseSource === "PAID" || entry.purchaseSource === "DISCOUNTED") {
            existing.hasPaid = true;
        }
        entryUsers.set(entry.userId, existing);
    });

    const usersWithEntries = Array.from(entryUsers.values());
    const totalBuyers = usersWithEntries.length;
    const repeatBuyers = usersWithEntries.filter((user) => user.entryCount > 1).length;
    const repeatBuyerRate = totalBuyers > 0 ? (repeatBuyers / totalBuyers) * 100 : 0;
    const newPlayersWithTicketPaid = usersWithEntries.filter(
        (user) => user.createdAt >= start && user.createdAt <= end && user.hasPaid,
    ).length;
    const newPlayersWithTicketFree = Math.max(
        newPlayersWithEntries - newPlayersWithTicketPaid,
        0,
    );
    const returningPlayersWithTicket = usersWithEntries.filter(
        (user) => user.createdAt < start,
    ).length;
    const returningPlayersWithTicketPaid = usersWithEntries.filter(
        (user) => user.createdAt < start && user.hasPaid,
    ).length;
    const returningPlayersWithTicketFree = Math.max(
        returningPlayersWithTicket - returningPlayersWithTicketPaid,
        0,
    );
    const repeatTicketUsersPaid = usersWithEntries.filter(
        (user) => user.entryCount > 1 && user.hasPaid,
    ).length;
    const repeatTicketUsersFree = Math.max(repeatBuyers - repeatTicketUsersPaid, 0);

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
        newPlayers: newPlayersInPeriod,
        newPlayersWithTicket: newPlayersWithEntries,
        newPlayersWithTicketPaid,
        newPlayersWithTicketFree,
        returningPlayers,
        returningPlayersWithTicket,
        returningPlayersWithTicketPaid,
        returningPlayersWithTicketFree,
        repeatBuyerRate,
        repeatBuyers,
        totalBuyers,
        repeatTicketUsersPaid,
        repeatTicketUsersFree,
        streakDistribution: streakData,
        daysSinceLastSession: daysSinceData,
    };
}

// ============================================================
// 3. GAMEPLAY QUALITY
// ============================================================

async function getGameplayData(start: Date, end: Date, platform?: string) {
    const gamePf = buildProductionGameWhere(platform);
    const gpf = buildProductionEntryWhere(platform);
    const now = new Date();

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
        gamesInRange,
        // Rank distribution
        rankedEntries,
        // Win rate (rank 1)
        winnersCount,
        totalRankedEntries,
        // Theme participation
        themeParticipation,
        currentOrNextGame,
    ] = await Promise.all([
        prisma.gameEntry.findMany({
            where: { ...gpf, game: { ...gamePf, startsAt: { gte: start, lte: end } } },
            select: {
                score: true,
                answered: true,
                answers: true,
                rank: true,
                leftAt: true,
                createdAt: true,
                paidAmount: true,
                purchaseSource: true,
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
            where: { game: { ...gamePf, startsAt: { gte: start, lte: end } } },
            select: {
                id: true,
                gameId: true,
                content: true,
                correctIndex: true,
                durationSec: true,
                roundIndex: true,
                orderInRound: true,
                game: { select: { title: true } },
            },
        }),
        prisma.game.findMany({
            where: { ...gamePf, startsAt: { gte: start, lte: end } },
            select: {
                id: true,
                startsAt: true,
                roundBreakSec: true,
            },
            take: 500,
        }),
        prisma.gameEntry.findMany({
            where: { ...gpf, game: { ...gamePf, startsAt: { gte: start, lte: end } }, rank: { not: null } },
            select: { rank: true, purchaseSource: true, createdAt: true, game: { select: { startsAt: true } } },
        }),
        prisma.gameEntry.count({ where: { ...gpf, game: { ...gamePf, startsAt: { gte: start, lte: end } }, rank: 1 } }),
        prisma.gameEntry.count({ where: { ...gpf, game: { ...gamePf, startsAt: { gte: start, lte: end } }, rank: { not: null } } }),
        prisma.game.groupBy({
            by: ["theme"],
            where: { ...gamePf, startsAt: { gte: start, lte: end } },
            _sum: { playerCount: true },
            _count: true,
            _avg: { prizePool: true },
        }),
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
            },
        }),
    ]);

    const previousComparableGame = currentOrNextGame
        ? await prisma.game.findFirst({
            where: {
                ...gamePf,
                platform: currentOrNextGame.platform,
                network: currentOrNextGame.network,
                endsAt: { lt: currentOrNextGame.startsAt },
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

    const [currentComparableEntries, previousComparableEntries] = currentOrNextGame
        ? await Promise.all([
            prisma.gameEntry.findMany({
                where: { gameId: currentOrNextGame.id, ...gpf },
                select: {
                    userId: true,
                    purchaseSource: true,
                },
            }),
            previousComparableGame
                ? prisma.gameEntry.findMany({
                    where: { gameId: previousComparableGame.id, ...gpf },
                    select: {
                        userId: true,
                        purchaseSource: true,
                        answered: true,
                    },
                })
                : Promise.resolve([]),
        ])
        : [[], []];

    const priorCurrentCohortUsers = currentOrNextGame
        ? await prisma.gameEntry.findMany({
            where: {
                ...gpf,
                userId: { in: currentComparableEntries.map((entry) => entry.userId) },
                game: { startsAt: { lt: currentOrNextGame.startsAt } },
            },
            select: { userId: true },
            distinct: ["userId"],
        })
        : [];

    const chatsByGame = new Map<
        string,
        Array<{ text: string; createdAt: Date; username: string; gameId: string }>
    >();
    const dbChatsInRange = await prisma.chat.findMany({
        where: {
            gameId: { in: gamesInRange.map((game) => game.id) },
        },
        orderBy: { createdAt: "asc" },
        select: {
            gameId: true,
            text: true,
            createdAt: true,
            user: {
                select: {
                    username: true,
                },
            },
        },
    });
    const dbChatsByGame = new Map<
        string,
        Array<{ text: string; createdAt: Date; username: string; gameId: string }>
    >();
    for (const chat of dbChatsInRange) {
        const existing = dbChatsByGame.get(chat.gameId) ?? [];
        existing.push({
            text: chat.text,
            createdAt: chat.createdAt,
            username: chat.user.username ?? "Unknown",
            gameId: chat.gameId,
        });
        dbChatsByGame.set(chat.gameId, existing);
    }
    const storedChatResults = await Promise.all(
        gamesInRange.map(async (game) => ({
            gameId: game.id,
            startsAt: game.startsAt,
            roundBreakSec: game.roundBreakSec,
            messages: await getStoredChatHistory(game.id),
        })),
    );
    const gameMetaById = new Map(
        gamesInRange.map((game) => [
            game.id,
            { startsAt: game.startsAt, roundBreakSec: game.roundBreakSec },
        ]),
    );
    for (const result of storedChatResults) {
        const fallbackMessages = dbChatsByGame.get(result.gameId) ?? [];
        const messages = result.messages.length > 0
            ? result.messages.map((message) => ({
                text: message.text,
                createdAt: new Date(message.ts),
                username: message.username,
                gameId: result.gameId,
            }))
            : fallbackMessages;
        chatsByGame.set(
            result.gameId,
            messages,
        );
    }

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

    const roundWindows = new Map<string, Array<{ round: number; startMs: number; endMs: number }>>();
    for (const [gameId, questions] of gameQuestions.entries()) {
        const ordered = [...questions].sort((a, b) =>
            a.roundIndex - b.roundIndex || a.orderInRound - b.orderInRound
        );
        const roundBreakSec = gameMetaById.get(gameId)?.roundBreakSec ?? 0;
        let cursorMs = 0;
        const windows: Array<{ round: number; startMs: number; endMs: number }> = [];

        for (let index = 0; index < ordered.length; index++) {
            const question = ordered[index];
            const startMs = cursorMs;
            const endMs = startMs + (question.durationSec * 1000);
            windows.push({ round: question.roundIndex, startMs, endMs });
            cursorMs = endMs;

            const nextQuestion = ordered[index + 1];
            if (nextQuestion && nextQuestion.roundIndex !== question.roundIndex) {
                cursorMs += roundBreakSec * 1000;
            }
        }

        roundWindows.set(gameId, windows);
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
    const ticketTypeStats = {
        paid: { entries: 0, noShow: 0, partial: 0, completedAll: 0, revenue: 0, noShowRevenue: 0 },
        free: { entries: 0, noShow: 0, partial: 0, completedAll: 0, revenue: 0, noShowRevenue: 0 },
    };
    const answerQuality = {
        paid: { correct: 0, answered: 0, totalMs: 0, msCount: 0, totalPoints: 0 },
        free: { correct: 0, answered: 0, totalMs: 0, msCount: 0, totalPoints: 0 },
    };
    let lateEntries = 0;
    let latePlayed = 0;
    let lateNoShows = 0;
    let startedEntries = 0;
    let reachedFinalQuestion = 0;
    const messagesByPlayer = new Map<string, number>();
    const messagesByGame = new Map<string, number>();
    const messagesByRoundMap = new Map<number, number>();
    const keywordCounts = new Map<string, number>();

    for (const entry of entries) {
        scores.push(entry.score);
        if (entry.leftAt) leftCount++;
        const isPaid =
            entry.purchaseSource === "PAID" || entry.purchaseSource === "DISCOUNTED";
        const ticketBucket = isPaid ? ticketTypeStats.paid : ticketTypeStats.free;
        const qualityBucket = isPaid ? answerQuality.paid : answerQuality.free;
        const questionCount = gameQuestionCounts.get(entry.game.id) ?? 0;
        const isLate = entry.createdAt > entry.game.startsAt;

        ticketBucket.entries++;
        ticketBucket.revenue += entry.paidAmount ?? 0;
        if (isLate) lateEntries++;

        const answers = entry.answers as Record<string, AnswerData> | null;
        if (!answers || typeof answers !== "object") continue;
        const answerEntries = Object.entries(answers);
        const answeredQuestionIds = new Set(answerEntries.map(([qId]) => qId));

        if (entry.answered > 0) {
            playedCount++;
            if (isLate) latePlayed++;
        } else {
            ticketBucket.noShow++;
            ticketBucket.noShowRevenue += entry.paidAmount ?? 0;
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
                ticketBucket.completedAll++;
            } else if (entry.answered > 0) {
                ticketBucket.partial++;
            }
        }

        for (const [qId, a] of answerEntries) {
            totalAnswered++;
            if (a.correct) totalCorrect++;
            if (a.ms > 0) { totalMs += a.ms; msCount++; }
            qualityBucket.answered++;
            if (a.correct) qualityBucket.correct++;
            qualityBucket.totalPoints += a.points;
            if (a.ms > 0) {
                qualityBucket.totalMs += a.ms;
                qualityBucket.msCount++;
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

    const paidTop10 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 10 &&
            (entry.purchaseSource === "PAID" || entry.purchaseSource === "DISCOUNTED")
    ).length;
    const freeTop10 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 10 &&
            entry.purchaseSource !== "PAID" && entry.purchaseSource !== "DISCOUNTED"
    ).length;
    const lateTop10 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 10 && entry.createdAt > entry.game.startsAt
    ).length;
    const lateTop3 = rankedEntries.filter(
        (entry) => entry.rank !== null && entry.rank <= 3 && entry.createdAt > entry.game.startsAt
    ).length;

    const chats = Array.from(chatsByGame.entries()).flatMap(([gameId, messages]) =>
        messages.map((message) => ({
            ...message,
            game: {
                startsAt: gameMetaById.get(gameId)?.startsAt ?? start,
            },
        })),
    );

    for (const chat of chats) {
        messagesByPlayer.set(chat.username, (messagesByPlayer.get(chat.username) ?? 0) + 1);
        messagesByGame.set(chat.gameId, (messagesByGame.get(chat.gameId) ?? 0) + 1);

        const elapsedMs = chat.createdAt.getTime() - chat.game.startsAt.getTime();
        const gameWindows = roundWindows.get(chat.gameId) ?? [];
        const matchingWindow = gameWindows.find((window) =>
            elapsedMs >= window.startMs && elapsedMs <= window.endMs
        );
        if (matchingWindow) {
            messagesByRoundMap.set(
                matchingWindow.round,
                (messagesByRoundMap.get(matchingWindow.round) ?? 0) + 1,
            );
        }

        const normalizedWords = chat.text
            .toLowerCase()
            .replace(/https?:\/\/\S+/g, " ")
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((word) => word.length >= 3 && !CHAT_STOPWORDS.has(word));

        for (const word of normalizedWords) {
            keywordCounts.set(word, (keywordCounts.get(word) ?? 0) + 1);
        }
    }

    const totalMessages = chats.length;
    const uniqueChatters = messagesByPlayer.size;
    const avgMessagesPerChatter = uniqueChatters > 0 ? totalMessages / uniqueChatters : 0;
    const avgMessagesPerEntry = entries.length > 0 ? totalMessages / entries.length : 0;
    const chatParticipationRate = entries.length > 0 ? (uniqueChatters / entries.length) * 100 : 0;
    const loudestChatterMessages = messagesByPlayer.size > 0
        ? Math.max(...messagesByPlayer.values())
        : 0;
    const loudestChatterShare = totalMessages > 0
        ? (loudestChatterMessages / totalMessages) * 100
        : 0;
    const avgMessagesPerGame = messagesByGame.size > 0
        ? totalMessages / messagesByGame.size
        : 0;
    const messagesByRound = Array.from(messagesByRoundMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([round, messages]) => ({ round, messages }));
    const topKeywords = Array.from(keywordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([word, count]) => ({ word, count }));

    const isPaidSource = (purchaseSource: string) =>
        purchaseSource === "PAID" || purchaseSource === "DISCOUNTED";

    const paidCurrentUsers = new Set(
        currentComparableEntries
            .filter((entry) => isPaidSource(entry.purchaseSource))
            .map((entry) => entry.userId),
    );
    const freeCurrentUsers = new Set(
        currentComparableEntries
            .filter((entry) => !isPaidSource(entry.purchaseSource))
            .map((entry) => entry.userId),
    );
    const previousParticipants = new Set(
        previousComparableEntries
            .filter((entry) => entry.answered > 0)
            .map((entry) => entry.userId),
    );
    const previousPaidUsers = new Set(
        previousComparableEntries
            .filter((entry) => isPaidSource(entry.purchaseSource))
            .map((entry) => entry.userId),
    );
    const previousFreeUsers = new Set(
        previousComparableEntries
            .filter((entry) => !isPaidSource(entry.purchaseSource))
            .map((entry) => entry.userId),
    );
    const priorAnyTicketUsers = new Set(priorCurrentCohortUsers.map((entry) => entry.userId));

    const summarizeCurrentCohort = (currentUsers: Set<string>, previousSameTypeUsers: Set<string>) => {
        const count = currentUsers.size;
        let playedLastGame = 0;
        let sameTypeLastGame = 0;
        let firstTime = 0;

        for (const userId of currentUsers) {
            if (previousParticipants.has(userId)) playedLastGame++;
            if (previousSameTypeUsers.has(userId)) sameTypeLastGame++;
            if (!priorAnyTicketUsers.has(userId)) firstTime++;
        }

        return {
            count,
            playedLastGame,
            playedLastGameRate: count > 0 ? (playedLastGame / count) * 100 : 0,
            sameTypeLastGame,
            sameTypeLastGameRate: count > 0 ? (sameTypeLastGame / count) * 100 : 0,
            firstTime,
            firstTimeRate: count > 0 ? (firstTime / count) * 100 : 0,
        };
    };

    let previousFreeToPaid = 0;
    for (const userId of previousFreeUsers) {
        if (paidCurrentUsers.has(userId)) previousFreeToPaid++;
    }

    const currentTicketCohorts = currentOrNextGame && previousComparableGame
        ? {
            currentGameTitle: currentOrNextGame.title,
            previousGameTitle: previousComparableGame.title,
            paid: summarizeCurrentCohort(paidCurrentUsers, previousPaidUsers),
            free: summarizeCurrentCohort(freeCurrentUsers, previousFreeUsers),
            previousFreeToPaid,
            previousFreeToPaidRate: previousFreeUsers.size > 0
                ? (previousFreeToPaid / previousFreeUsers.size) * 100
                : 0,
            previousFreeCount: previousFreeUsers.size,
        }
        : null;

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
        currentTicketCohorts,
        behavior: {
            ticketMix: {
                paidEntries: ticketTypeStats.paid.entries,
                freeEntries: ticketTypeStats.free.entries,
                paidCompletedAll: ticketTypeStats.paid.completedAll,
                freeCompletedAll: ticketTypeStats.free.completedAll,
                paidPartial: ticketTypeStats.paid.partial,
                freePartial: ticketTypeStats.free.partial,
                paidNoShow: ticketTypeStats.paid.noShow,
                freeNoShow: ticketTypeStats.free.noShow,
                paidNoShowRate: ticketTypeStats.paid.entries > 0
                    ? (ticketTypeStats.paid.noShow / ticketTypeStats.paid.entries) * 100
                    : 0,
                freeNoShowRate: ticketTypeStats.free.entries > 0
                    ? (ticketTypeStats.free.noShow / ticketTypeStats.free.entries) * 100
                    : 0,
            },
            monetization: {
                paidRevenue: ticketTypeStats.paid.revenue,
                paidNoShowRevenue: ticketTypeStats.paid.noShowRevenue,
                paidNoShowRevenueRate: ticketTypeStats.paid.revenue > 0
                    ? (ticketTypeStats.paid.noShowRevenue / ticketTypeStats.paid.revenue) * 100
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
                paidAccuracy: answerQuality.paid.answered > 0
                    ? (answerQuality.paid.correct / answerQuality.paid.answered) * 100
                    : 0,
                freeAccuracy: answerQuality.free.answered > 0
                    ? (answerQuality.free.correct / answerQuality.free.answered) * 100
                    : 0,
                paidAvgResponseMs: answerQuality.paid.msCount > 0
                    ? answerQuality.paid.totalMs / answerQuality.paid.msCount
                    : 0,
                freeAvgResponseMs: answerQuality.free.msCount > 0
                    ? answerQuality.free.totalMs / answerQuality.free.msCount
                    : 0,
                paidAvgPointsPerAnswer: answerQuality.paid.answered > 0
                    ? answerQuality.paid.totalPoints / answerQuality.paid.answered
                    : 0,
                freeAvgPointsPerAnswer: answerQuality.free.answered > 0
                    ? answerQuality.free.totalPoints / answerQuality.free.answered
                    : 0,
            },
            leaderboard: {
                paidTop10,
                freeTop10,
            },
            chat: {
                totalMessages,
                uniqueChatters,
                participationRate: chatParticipationRate,
                avgMessagesPerChatter,
                avgMessagesPerEntry,
                avgMessagesPerGame,
                loudestChatterMessages,
                loudestChatterShare,
                messagesByRound,
                topKeywords,
            },
        },
    };
}

// ============================================================
// 4. REVENUE ANALYTICS
// ============================================================

async function getRevenueData(start: Date, end: Date, platform?: string) {
    const gpf = buildProductionEntryWhere(platform);
    const periodDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start.getTime() - periodDays * 24 * 60 * 60 * 1000);

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
        prisma.gameEntry.aggregate({ where: { paidAt: { not: null, gte: start, lte: end }, ...gpf }, _sum: { paidAmount: true } }),
        prisma.gameEntry.aggregate({ where: { paidAt: { not: null, gte: previousStart, lt: start }, ...gpf }, _sum: { paidAmount: true } }),
        prisma.gameEntry.count({ where: { paidAt: { not: null, gte: start, lte: end }, ...gpf } }),
        prisma.gameEntry.count({ where: { paidAt: { not: null, gte: previousStart, lt: start }, ...gpf } }),
        prisma.gameEntry.groupBy({ by: ["userId"], where: { paidAt: { not: null, gte: start, lte: end }, ...gpf } }).then((r) => r.length),
        prisma.gameEntry.aggregate({ where: { paidAt: { not: null, gte: start, lte: end }, ...gpf }, _avg: { paidAmount: true } }),
        prisma.gameEntry.groupBy({ by: ["userId"], where: { paidAt: { not: null, gte: start, lte: end }, ...gpf }, _count: true }),
        prisma.gameEntry.aggregate({ where: { prize: { gt: 0 }, paidAt: { not: null, gte: start, lte: end }, ...gpf }, _count: true, _sum: { prize: true } }),
        prisma.gameEntry.aggregate({ where: { prize: { gt: 0 }, claimedAt: { not: null }, paidAt: { not: null, gte: start, lte: end }, ...gpf }, _count: true, _sum: { prize: true } }),
        prisma.gameEntry.aggregate({ where: { prize: { gt: 0 }, claimedAt: null, paidAt: { not: null, gte: start, lte: end }, ...gpf }, _sum: { prize: true } }),
        prisma.gameEntry.findMany({
            where: { paidAt: { not: null, gte: start, lte: end }, ...gpf },
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
                ...gpf,
                answered: { gt: 0 },
                OR: [
                    { paidAt: { not: null, gte: start, lte: end } },
                    {
                        purchaseSource: { in: [...FREE_TICKET_SOURCES] },
                        createdAt: { gte: start, lte: end },
                    },
                ],
            },
            _avg: { score: true },
        }),
        prisma.gameEntry.aggregate({ where: { paidAt: { not: null }, ...gpf }, _sum: { paidAmount: true } }),
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
    const chartData = Array.from(dailyMap.entries()).sort().map(([date, data]) => ({
        date: date.slice(5),
        ...data,
    }));
    const topGames = summarizeRevenueByGame(dailyEntries as RevenueEntryWithGame[]).slice(0, 10);

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

// ============================================================
// PAGE COMPONENT
// ============================================================

export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ range?: string; tab?: string; platform?: string }>;
}) {
    const { range, tab, platform } = await searchParams;
    const { start, end } = getDateRangeFromParam(range ?? "7d");
    const validTabs: AnalyticsTab[] = ["overview", "games", "players"];
    const activeTab = validTabs.includes(tab as AnalyticsTab)
        ? (tab as AnalyticsTab)
        : "overview";

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
                    <PlatformFilter />
                    <DateRangePicker currentRange={range || "7d"} />
                </div>
            </div>

            <AnalyticsTabs currentTab={activeTab} />

            <Suspense fallback={<AnalyticsSkeleton />}>
                <AnalyticsContent start={start} end={end} activeTab={activeTab} platform={platform} />
            </Suspense>
        </div>
    );
}

async function AnalyticsContent({
    start,
    end,
    activeTab,
    platform,
}: {
    start: Date;
    end: Date;
    activeTab: AnalyticsTab;
    platform?: string;
}) {
    if (activeTab === "overview") {
        const [data, retention] = await Promise.all([
            getCoreDashboard(start, end, platform),
            getRetentionData(start, end, platform),
        ]);
        return <OverviewTab data={data} retention={retention} />;
    }
    if (activeTab === "games") {
        const gameplay = await getGameplayData(start, end, platform);
        return <GameplayTab data={gameplay} />;
    }
    if (activeTab === "players") {
        const [revenue, retention] = await Promise.all([
            getRevenueData(start, end, platform),
            getRetentionData(start, end, platform),
        ]);
        return <RevenueRetentionTab revenue={revenue} retention={retention} />;
    }
    return null;
}

// ============================================================
// TAB: OVERVIEW (The "first dashboard")
// ============================================================

function OverviewTab({
    data,
    retention,
}: {
    data: Awaited<ReturnType<typeof getCoreDashboard>>;
    retention: Awaited<ReturnType<typeof getRetentionData>>;
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
                    tooltip="The share of users created in the selected range who reached game access or claimed any ticket, free or paid."
                    icon={<CheckCircleIcon className="h-5 w-5 text-[#14B985]" />}
                    subtitle="signup → onboarded"
                    glowVariant="success"
                />
                <KPICard
                    title="Purchase → Play"
                    value={`${data.purchaseToCompletionRate.toFixed(1)}%`}
                    tooltip="The share of claimed tickets, free or paid, that answered at least one question. This shows how many ticketed players actually engage after entry."
                    icon={<ArrowTrendingUpIcon className="h-5 w-5 text-[#FB72FF]" />}
                    subtitle={`${data.leaveRate.toFixed(1)}% leave rate`}
                    glowVariant="pink"
                />
                <KPICard
                    title="Activation Rate"
                    value={`${data.activationRate.toFixed(1)}%`}
                    tooltip="The share of users created in the selected range who reached their first ticket, free or paid. This is signup-to-first-ticket activation, not retention."
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
                <MiniStat label="Avg Score" value={data.avgScore.toFixed(0)} color="#FFC931" tooltip="Average final score across ticketed entries, free or paid, with answer data in the selected range." />
                <MiniStat label="Avg Answer Speed" value={`${(data.avgAnswerSpeed / 1000).toFixed(1)}s`} color="#00CFF2" tooltip="Average time taken to answer a question, based on stored per-answer latency in milliseconds." />
                <MiniStat label="Fee / Game" value={`$${data.revenuePerGame.toFixed(2)}`} color="#14B985" tooltip="Average protocol revenue generated per ended game in the selected range." />
                <MiniStat label="Claim Rate" value={`${data.claimRate.toFixed(1)}%`} color="#FB72FF" tooltip="The share of prize-winning entries that have already claimed their payouts." />
                <MiniStat label="DAU/WAU" value={`${retention.dauWauRatio.toFixed(0)}%`} color="#FFC931" tooltip="Daily active users divided by weekly active users. Higher values usually mean better short-term stickiness." />
            </div>

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
                    <RetentionBar label="New Players" value={retention.newPlayers} total={retention.newPlayers + retention.returningPlayers} color="#14B985" tooltip="Users created in the selected range who were also active during that same range." />
                    <RetentionBar
                        label="New Players With Ticket"
                        value={retention.newPlayersWithTicket}
                        total={retention.newPlayers}
                        color="#FB72FF"
                        tooltip="New players created in the selected range who claimed at least one ticket in that same range."
                        segments={[
                            { value: retention.newPlayersWithTicketPaid, color: "#14B985", label: "Paid" },
                            { value: retention.newPlayersWithTicketFree, color: "#00CFF2", label: "Free" },
                        ]}
                    />
                    <RetentionBar label="Returning" value={retention.returningPlayers} total={retention.newPlayers + retention.returningPlayers} color="#00CFF2" tooltip="Active users in the selected range who were created before that range started." />
                    <RetentionBar
                        label="Returning Players With Ticket"
                        value={retention.returningPlayersWithTicket}
                        total={retention.returningPlayers}
                        color="#14B985"
                        tooltip="Returning players who claimed at least one ticket in the selected range."
                        segments={[
                            { value: retention.returningPlayersWithTicketPaid, color: "#14B985", label: "Paid" },
                            { value: retention.returningPlayersWithTicketFree, color: "#00CFF2", label: "Free" },
                        ]}
                    />
                    <RetentionBar
                        label="Repeat Ticket Users"
                        value={retention.repeatBuyers}
                        total={retention.totalBuyers}
                        color="#FFC931"
                        tooltip="Unique users with more than one ticket in the selected range."
                        segments={[
                            { value: retention.repeatTicketUsersPaid, color: "#14B985", label: "Has paid ticket" },
                            { value: retention.repeatTicketUsersFree, color: "#00CFF2", label: "Free only" },
                        ]}
                    />
                </div>
            </div>

            {/* Game performance table */}
            <GamePerformanceTable games={data.gamePerformance} />
        </div>
    );
}

// ============================================================
// TAB: GAMEPLAY QUALITY
// ============================================================

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
                <MiniStat label="Answered / Last 5" value={data.answeredPlayersAcrossLastFiveGames.toLocaleString()} color="#14B985" tooltip="Unique players who answered at least one question across the latest 5 ended games, including both free and paid tickets." />
            </div>

            <div className="rounded-2xl border border-white/10 p-6 space-y-6">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Current Ticket Cohorts</h3>
                        <p className="text-sm text-white/50">
                            Repeat, first-time, and free-to-paid conversion signals for the current ticket-selling game
                        </p>
                    </div>
                    {data.currentTicketCohorts ? (
                        <div className="text-right text-xs text-white/40">
                            <div>{data.currentTicketCohorts.currentGameTitle}</div>
                            <div>vs {data.currentTicketCohorts.previousGameTitle}</div>
                        </div>
                    ) : null}
                </div>

                {data.currentTicketCohorts ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                                <h4 className="text-sm font-semibold text-white font-display mb-4">Paid Cohort</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <MiniStat label="Current Paid" value={data.currentTicketCohorts.paid.count.toLocaleString()} color="#FFC931" tooltip="Current paid or discounted ticket holders in the live or next game." />
                                    <MiniStat label="Played Last Game" value={`${data.currentTicketCohorts.paid.playedLastGameRate.toFixed(1)}%`} color="#14B985" tooltip="Current paid ticket holders who answered at least one question in the previous comparable game." />
                                    <MiniStat label="Paid Last Game" value={`${data.currentTicketCohorts.paid.sameTypeLastGameRate.toFixed(1)}%`} color="#00CFF2" tooltip="Current paid ticket holders who also held a paid ticket in the previous comparable game." />
                                    <MiniStat label="First Ticket Ever" value={`${data.currentTicketCohorts.paid.firstTimeRate.toFixed(1)}%`} color="#FB72FF" tooltip="Current paid ticket holders with no earlier ticket history, free or paid." />
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                                <h4 className="text-sm font-semibold text-white font-display mb-4">Free Cohort</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <MiniStat label="Current Free" value={data.currentTicketCohorts.free.count.toLocaleString()} color="#00CFF2" tooltip="Current free-ticket holders in the live or next game." />
                                    <MiniStat label="Played Last Game" value={`${data.currentTicketCohorts.free.playedLastGameRate.toFixed(1)}%`} color="#14B985" tooltip="Current free-ticket holders who answered at least one question in the previous comparable game." />
                                    <MiniStat label="Free Last Game" value={`${data.currentTicketCohorts.free.sameTypeLastGameRate.toFixed(1)}%`} color="#00CFF2" tooltip="Current free-ticket holders who also had a free ticket in the previous comparable game." />
                                    <MiniStat label="First Ticket Ever" value={`${data.currentTicketCohorts.free.firstTimeRate.toFixed(1)}%`} color="#FB72FF" tooltip="Current free-ticket holders with no earlier ticket history, free or paid." />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <MiniStat label="Prev Free Cohort" value={data.currentTicketCohorts.previousFreeCount.toLocaleString()} color="#00CFF2" tooltip="Free-ticket holders in the previous comparable game." />
                            <MiniStat label="Free → Paid" value={data.currentTicketCohorts.previousFreeToPaid.toLocaleString()} color="#FFC931" tooltip="Previous free-ticket holders who now hold a paid ticket in the current game." />
                            <MiniStat label="Free → Paid Rate" value={`${data.currentTicketCohorts.previousFreeToPaidRate.toFixed(1)}%`} color="#14B985" tooltip="Share of the previous free cohort that converted into paid tickets for the current game." />
                        </div>
                    </>
                ) : (
                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 text-sm text-white/50">
                        No live or upcoming game pair is available yet for current-ticket cohort analytics.
                    </div>
                )}
            </div>

            {/* Behavior Signals */}
            <div className="rounded-2xl border border-white/10 p-6 space-y-6">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white font-display">Behavior Signals</h3>
                        <p className="text-sm text-white/50">
                            No-shows, late joins, and paid-vs-free quality signals that explain how the lobby really behaved
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniStat
                        label="Paid No-Show"
                        value={`${data.behavior.ticketMix.paidNoShowRate.toFixed(1)}%`}
                        color="#FFC931"
                        tooltip="Paid or discounted entries that never answered a question."
                    />
                    <MiniStat
                        label="Free No-Show"
                        value={`${data.behavior.ticketMix.freeNoShowRate.toFixed(1)}%`}
                        color="#00CFF2"
                        tooltip="Free entries that never answered a question."
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MiniStat
                        label="Lobby Messages"
                        value={data.behavior.chat.totalMessages.toLocaleString()}
                        color="#FFC931"
                        tooltip="Total chat messages sent inside game lobbies in the selected range."
                    />
                    <MiniStat
                        label="Chat Participation"
                        value={`${data.behavior.chat.participationRate.toFixed(1)}%`}
                        color="#00CFF2"
                        tooltip="Share of ticketed players who sent at least one lobby message."
                    />
                    <MiniStat
                        label="Avg / Chatter"
                        value={data.behavior.chat.avgMessagesPerChatter.toFixed(1)}
                        color="#FB72FF"
                        tooltip="Average number of messages sent by players who actually chatted."
                    />
                    <MiniStat
                        label="Avg / Ticketed Player"
                        value={data.behavior.chat.avgMessagesPerEntry.toFixed(2)}
                        color="#14B985"
                        tooltip="Average number of lobby messages per ticketed entry, including silent players."
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Ticket Intent Split</h4>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-xl bg-[#FFC931]/10 border border-[#FFC931]/20 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/50">Paid</div>
                                <div className="mt-2 text-2xl font-bold text-[#FFC931] font-body">{data.behavior.ticketMix.paidEntries}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.ticketMix.paidCompletedAll} finished
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#00CFF2]/10 border border-[#00CFF2]/20 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/50">Free</div>
                                <div className="mt-2 text-2xl font-bold text-[#00CFF2] font-body">{data.behavior.ticketMix.freeEntries}</div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.ticketMix.freeCompletedAll} finished
                                </div>
                            </div>
                            <div className="rounded-xl bg-[#FB72FF]/10 border border-[#FB72FF]/20 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/50">Dead Money</div>
                                <div className="mt-2 text-2xl font-bold text-[#FB72FF] font-body">
                                    ${data.behavior.monetization.paidNoShowRevenue.toFixed(2)}
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    {data.behavior.monetization.paidNoShowRevenueRate.toFixed(1)}% of paid ticket revenue
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2 text-sm text-white/60">
                            <div className="flex items-center justify-between">
                                <span>Paid partial runs</span>
                                <span className="font-body text-white">{data.behavior.ticketMix.paidPartial}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Free partial runs</span>
                                <span className="font-body text-white">{data.behavior.ticketMix.freePartial}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Paid no-shows</span>
                                <span className="font-body text-white">{data.behavior.ticketMix.paidNoShow}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>Free no-shows</span>
                                <span className="font-body text-white">{data.behavior.ticketMix.freeNoShow}</span>
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
                                <span className="text-white/60">Free players in top 10</span>
                                <span className="font-body text-[#00CFF2]">{data.behavior.leaderboard.freeTop10}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm">
                                <span className="text-white/60">Paid players in top 10</span>
                                <span className="font-body text-[#FFC931]">{data.behavior.leaderboard.paidTop10}</span>
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
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Paid vs Free Answer Quality</h4>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Accuracy gap</div>
                                <div className="mt-2 text-xl font-bold text-[#14B985] font-body">
                                    {Math.abs(data.behavior.answerQuality.paidAccuracy - data.behavior.answerQuality.freeAccuracy).toFixed(1)} pts
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    Paid {data.behavior.answerQuality.paidAccuracy.toFixed(1)}% vs free {data.behavior.answerQuality.freeAccuracy.toFixed(1)}%
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Avg speed</div>
                                <div className="mt-2 text-xl font-bold text-[#00CFF2] font-body">
                                    {(data.behavior.answerQuality.paidAvgResponseMs / 1000).toFixed(1)}s
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    Free {(data.behavior.answerQuality.freeAvgResponseMs / 1000).toFixed(1)}s
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Points / answer</div>
                                <div className="mt-2 text-xl font-bold text-[#FFC931] font-body">
                                    {data.behavior.answerQuality.paidAvgPointsPerAnswer.toFixed(0)}
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    Free {data.behavior.answerQuality.freeAvgPointsPerAnswer.toFixed(0)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Lobby Chat Intensity</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Avg messages / game</div>
                                <div className="mt-2 text-2xl font-bold text-[#FFC931] font-body">
                                    {data.behavior.chat.avgMessagesPerGame.toFixed(1)}
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    across games in the selected range
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/5 border border-white/8 p-4">
                                <div className="text-xs uppercase tracking-wider text-white/40">Loudest chatter share</div>
                                <div className="mt-2 text-2xl font-bold text-[#00CFF2] font-body">
                                    {data.behavior.chat.loudestChatterShare.toFixed(1)}%
                                </div>
                                <div className="mt-1 text-[11px] text-white/40">
                                    top chatter sent {data.behavior.chat.loudestChatterMessages} messages
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5">
                        <h4 className="text-sm font-semibold text-white font-display mb-4">Lobby Chat Read</h4>
                        <div className="space-y-3 text-sm text-white/60">
                            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/8 p-4">
                                <span>Unique chatters</span>
                                <span className="font-body text-white">{data.behavior.chat.uniqueChatters}</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/8 p-4">
                                <span>Silent ticketed players</span>
                                <span className="font-body text-white">
                                    {Math.max(data.totalPlayers - data.behavior.chat.uniqueChatters, 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ChatAnalytics
                data={{
                    totalMessages: data.behavior.chat.totalMessages,
                    uniqueChatters: data.behavior.chat.uniqueChatters,
                    totalPlayers: data.totalPlayers,
                    participationRate: data.behavior.chat.participationRate,
                    messagesByRound: data.behavior.chat.messagesByRound,
                    topKeywords: data.behavior.chat.topKeywords,
                }}
            />

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
}: {
    revenue: Awaited<ReturnType<typeof getRevenueData>>;
    retention: Awaited<ReturnType<typeof getRetentionData>>;
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
