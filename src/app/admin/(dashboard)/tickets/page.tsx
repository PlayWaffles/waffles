import { prisma } from "@/lib/db";
import Link from "next/link";
import { TicketIcon, CheckCircleIcon, ClockIcon } from "@heroicons/react/24/outline";
import { GameFilter } from "./_components/GameFilter";
import { IssueFreeTicketCard } from "./_components/IssueFreeTicketCard";
import { TicketReconciliationCard } from "./_components/TicketReconciliationCard";
import { RecoverPaidTicketButton } from "./_components/RecoverPaidTicketButton";
import { TicketPurchaseSource } from "@prisma";
import { formatUnits, parseAbiItem } from "viem";
import { getPublicClient, getWaffleContractAddress, PAYMENT_TOKEN_DECIMALS } from "@/lib/chain";
import type { ChainPlatform } from "@/lib/chain/platform";
import {
    buildProductionEntryWhere,
    buildProductionGameWhere,
    calculateProtocolRevenue,
} from "@/lib/admin-utils";

const BASE_MAINNET_SCAN_WINDOW = BigInt(500);
const DEFAULT_SCAN_WINDOW = BigInt(100_000);
const MAX_UNRESOLVED_PURCHASES = 50;
const BASE_MAINNET_LOG_BLOCK_CHUNK = BigInt(10);
const DEFAULT_LOG_BLOCK_CHUNK = BigInt(2_000);
const ticketPurchasedEvent = parseAbiItem(
    "event TicketPurchased(bytes32 indexed gameId, address indexed buyer, uint256 amount)",
);

type OnchainMismatchRow = {
    platform: ChainPlatform;
    txHash: string;
    gameOnchainId: string;
    buyer: string;
    amountFormatted: string;
    blockNumber: bigint;
    gameId?: string;
    gameTitle?: string;
    userId?: string;
    username?: string | null;
    status: "MISSING_IN_DB" | "USER_NOT_FOUND" | "GAME_NOT_FOUND" | "ENTRY_EXISTS";
    note: string;
};

function getChainScanWindow(platform: ChainPlatform) {
    return platform === "FARCASTER" ? BASE_MAINNET_SCAN_WINDOW : DEFAULT_SCAN_WINDOW;
}

function getLogBlockChunk(platform: ChainPlatform) {
    return platform === "FARCASTER"
        ? BASE_MAINNET_LOG_BLOCK_CHUNK
        : DEFAULT_LOG_BLOCK_CHUNK;
}

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
    const where: any = buildProductionEntryWhere();

    // Filter by ticket status
    if (searchParams.status === "paid") {
        where.paidAt = { not: null };
    } else if (searchParams.status === "free") {
        where.purchaseSource = {
            in: [TicketPurchaseSource.FREE_ADMIN, TicketPurchaseSource.FREE_PLAYER],
        };
    } else if (searchParams.status === "unpaid") {
        where.paidAt = null;
        where.purchaseSource = {
            notIn: [TicketPurchaseSource.FREE_ADMIN, TicketPurchaseSource.FREE_PLAYER],
        };
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
    const productionEntriesWhere = buildProductionEntryWhere();
    const productionGamesWhere = buildProductionGameWhere();
    const [totalEntries, paidEntries, freeEntries, claimedPrizes, games] = await Promise.all([
        prisma.gameEntry.count({ where: productionEntriesWhere }),
        prisma.gameEntry.count({ where: { ...productionEntriesWhere, paidAt: { not: null } } }),
        prisma.gameEntry.count({
            where: {
                ...productionEntriesWhere,
                purchaseSource: {
                    in: [TicketPurchaseSource.FREE_ADMIN, TicketPurchaseSource.FREE_PLAYER],
                },
            },
        }),
        prisma.gameEntry.count({ where: { ...productionEntriesWhere, claimedAt: { not: null } } }),
        prisma.game.findMany({
            where: productionGamesWhere,
            orderBy: { startsAt: "desc" },
            take: 20,
            select: { id: true, title: true },
        }),
    ]);

    const totalRevenue = await prisma.gameEntry.aggregate({
        where: { ...productionEntriesWhere, paidAt: { not: null } },
        _sum: { paidAmount: true },
    });

    return {
        totalEntries,
        paidEntries,
        freeEntries,
        pendingEntries: totalEntries - paidEntries - freeEntries,
        claimedPrizes,
        totalRevenue: calculateProtocolRevenue(totalRevenue._sum.paidAmount),
        games,
    };
}

async function getRecentOnchainMismatches(): Promise<OnchainMismatchRow[]> {
    const platforms: ChainPlatform[] = ["FARCASTER", "MINIPAY"];
    const allRows = await Promise.all(platforms.map((platform) => getPlatformMismatches(platform)));

    return allRows
        .flat()
        .sort((a, b) => Number(b.blockNumber - a.blockNumber))
        .slice(0, MAX_UNRESOLVED_PURCHASES);
}

async function getPlatformMismatches(platform: ChainPlatform): Promise<OnchainMismatchRow[]> {
    const publicClient = getPublicClient(platform);
    const contractAddress = getWaffleContractAddress(platform);
    const latestBlock = await publicClient.getBlockNumber();
    const chainScanWindow = getChainScanWindow(platform);
    const fromBlock = latestBlock > chainScanWindow ? latestBlock - chainScanWindow : BigInt(0);
    const logs = await getTicketPurchasedLogs({
        platform,
        address: contractAddress,
        fromBlock,
        toBlock: latestBlock,
    });

    if (logs.length === 0) {
        return [];
    }

    const purchases = logs
        .map((log) => {
            const args = log.args as unknown as {
                gameId: `0x${string}`;
                buyer: `0x${string}`;
                amount: bigint;
            };

            if (!log.transactionHash) {
                return null;
            }

            return {
                platform,
                txHash: log.transactionHash,
                gameOnchainId: args.gameId,
                buyer: args.buyer.toLowerCase(),
                amountFormatted: formatUnits(args.amount, PAYMENT_TOKEN_DECIMALS),
                blockNumber: log.blockNumber ?? BigInt(0),
            };
        })
        .filter((purchase): purchase is NonNullable<typeof purchase> => Boolean(purchase));

    if (purchases.length === 0) {
        return [];
    }

    const uniqueOnchainIds = [...new Set(purchases.map((purchase) => purchase.gameOnchainId.toLowerCase()))];
    const uniqueWallets = [...new Set(purchases.map((purchase) => purchase.buyer.toLowerCase()))];
    const uniqueTxHashes = [...new Set(purchases.map((purchase) => purchase.txHash.toLowerCase()))];

    const [games, users, linkedWallets, entriesByTxHash] = await Promise.all([
        prisma.game.findMany({
            where: {
                platform,
                OR: uniqueOnchainIds.map((onchainId) => ({
                    onchainId: { equals: onchainId, mode: "insensitive" },
                })),
            },
            select: {
                id: true,
                title: true,
                onchainId: true,
            },
        }),
        prisma.user.findMany({
            where: {
                platform,
                OR: [
                    ...uniqueWallets.map((wallet) => ({
                        wallet: { equals: wallet, mode: "insensitive" as const },
                    })),
                    ...(platform === "FARCASTER"
                        ? [{
                            wallets: {
                                some: {
                                    wallet: { in: uniqueWallets },
                                },
                            },
                        }]
                        : []),
                ],
            },
            select: {
                id: true,
                username: true,
                wallet: true,
            },
        }),
        platform === "FARCASTER"
            ? prisma.userWallet.findMany({
                where: {
                    platform: "FARCASTER",
                    wallet: { in: uniqueWallets },
                },
                select: {
                    wallet: true,
                    userId: true,
                },
            })
            : Promise.resolve([]),
        prisma.gameEntry.findMany({
            where: {
                txHash: {
                    in: uniqueTxHashes,
                },
            },
            select: {
                id: true,
                txHash: true,
            },
        }),
    ]);

    const gameByOnchainId = new Map(
        games
            .filter((game) => game.onchainId)
            .map((game) => [game.onchainId!.toLowerCase(), game]),
    );
    const userByWallet = new Map(
        users
            .filter((user) => user.wallet)
            .map((user) => [user.wallet!.toLowerCase(), user]),
    );
    const userById = new Map(users.map((user) => [user.id, user]));
    for (const linkedWallet of linkedWallets) {
        const user = userById.get(linkedWallet.userId);
        if (user) {
            userByWallet.set(linkedWallet.wallet.toLowerCase(), user);
        }
    }
    const entryByTxHash = new Set(
        entriesByTxHash
            .map((entry) => entry.txHash?.toLowerCase())
            .filter((txHash): txHash is string => Boolean(txHash)),
    );

    const candidatePairs = purchases
        .map((purchase) => {
            const game = gameByOnchainId.get(purchase.gameOnchainId.toLowerCase());
            const user = userByWallet.get(purchase.buyer);

            if (!game || !user) return null;

            return {
                key: `${game.id}:${user.id}`,
                gameId: game.id,
                userId: user.id,
            };
        })
        .filter((pair): pair is NonNullable<typeof pair> => Boolean(pair));

    const existingEntries = candidatePairs.length
        ? await prisma.gameEntry.findMany({
            where: {
                OR: [...new Map(candidatePairs.map((pair) => [pair.key, pair])).values()].map((pair) => ({
                    gameId: pair.gameId,
                    userId: pair.userId,
                })),
            },
            select: {
                id: true,
                gameId: true,
                userId: true,
                purchaseSource: true,
            },
        })
        : [];

    const entryByGameUser = new Map(
        existingEntries.map((entry) => [`${entry.gameId}:${entry.userId}`, entry]),
    );

    return purchases
        .filter((purchase) => !entryByTxHash.has(purchase.txHash.toLowerCase()))
        .map((purchase) => {
            const game = gameByOnchainId.get(purchase.gameOnchainId.toLowerCase());
            const user = userByWallet.get(purchase.buyer);
            const existingEntry =
                game && user ? entryByGameUser.get(`${game.id}:${user.id}`) : undefined;

            if (!game) {
                return {
                    ...purchase,
                    status: "GAME_NOT_FOUND" as const,
                    note: "No matching game found in the DB for this onchain gameId.",
                };
            }

            if (!user) {
                return {
                    ...purchase,
                    gameId: game.id,
                    gameTitle: game.title,
                    status: "USER_NOT_FOUND" as const,
                    note: "Wallet is not linked to any user on this platform yet.",
                };
            }

            if (existingEntry) {
                return {
                    ...purchase,
                    gameId: game.id,
                    gameTitle: game.title,
                    userId: user.id,
                    username: user.username,
                    status: "ENTRY_EXISTS" as const,
                    note:
                        existingEntry.purchaseSource === TicketPurchaseSource.PAID
                            ? "User already has a paid entry; txHash is missing or different."
                            : "User already has a non-paid entry for this game and needs review.",
                };
            }

            return {
                ...purchase,
                gameId: game.id,
                gameTitle: game.title,
                userId: user.id,
                username: user.username,
                status: "MISSING_IN_DB" as const,
                note: "Paid onchain and safe to recover into the DB.",
            };
        });
}

async function getTicketPurchasedLogs({
    platform,
    address,
    fromBlock,
    toBlock,
}: {
    platform: ChainPlatform;
    address: `0x${string}`;
    fromBlock: bigint;
    toBlock: bigint;
}) {
    const publicClient = getPublicClient(platform);
    const logBlockChunk = getLogBlockChunk(platform);
    const logs = [];

    for (let start = fromBlock; start <= toBlock; start += logBlockChunk) {
        const end = start + logBlockChunk - BigInt(1) < toBlock
            ? start + logBlockChunk - BigInt(1)
            : toBlock;

        let batch;
        try {
            batch = await publicClient.getLogs({
                address,
                event: ticketPurchasedEvent,
                fromBlock: start,
                toBlock: end,
            });
        } catch (error) {
            console.error("[admin-tickets]", {
                stage: "get-logs-failed",
                platform,
                address,
                fromBlock: start.toString(),
                toBlock: end.toString(),
                error: error instanceof Error ? error.message : "Unknown error",
            });
            return [];
        }

        logs.push(...batch);
    }

    return logs;
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
    const [{ entries, total, page, pageSize }, stats, onchainMismatches] = await Promise.all([
        getTickets(resolvedParams),
        getStats(),
        getRecentOnchainMismatches(),
    ]);
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex flex-col gap-1">
                    <h2 className="text-lg font-bold text-white font-display">
                        Recent Onchain Purchases Missing From DB
                    </h2>
                    <p className="text-sm text-white/60">
                        Crawls recent TicketPurchased events on both supported chains and highlights unresolved purchases.
                    </p>
                </div>

                {onchainMismatches.length === 0 ? (
                    <p className="text-sm text-white/50">
                        No unresolved recent onchain purchases found.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Platform
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Buyer
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Game
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Amount
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Tx
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50 font-display">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {onchainMismatches.map((row) => (
                                    <tr key={row.txHash} className="border-b border-white/5 align-top">
                                        <td className="px-4 py-4 text-sm text-white">
                                            {row.platform}
                                        </td>
                                        <td className="px-4 py-4 text-sm text-white">
                                            <div className="space-y-1">
                                                {row.userId ? (
                                                    <Link href={`/admin/users/${row.userId}`} className="font-medium hover:text-[#FFC931]">
                                                        {row.username || row.buyer}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium">{row.buyer}</span>
                                                )}
                                                <p className="font-mono text-xs text-white/40">{row.buyer}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm text-white">
                                            <div className="space-y-1">
                                                {row.gameId ? (
                                                    <Link href={`/admin/games/${row.gameId}`} className="font-medium hover:text-[#FFC931]">
                                                        {row.gameTitle || row.gameOnchainId}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium">{row.gameOnchainId}</span>
                                                )}
                                                <p className="font-mono text-xs text-white/40">{row.gameOnchainId}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm font-mono text-[#14B985]">
                                            ${Number(row.amountFormatted).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-4 text-sm">
                                            <div className="space-y-1">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                                        row.status === "MISSING_IN_DB"
                                                            ? "bg-[#14B985]/15 text-[#14B985]"
                                                            : row.status === "ENTRY_EXISTS"
                                                                ? "bg-[#FFC931]/15 text-[#FFC931]"
                                                                : "bg-red-500/15 text-red-300"
                                                    }`}
                                                >
                                                    {row.status === "MISSING_IN_DB"
                                                        ? "Recoverable"
                                                        : row.status === "ENTRY_EXISTS"
                                                            ? "Needs Review"
                                                            : "Blocked"}
                                                </span>
                                                <p className="max-w-[260px] text-xs text-white/50">{row.note}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-sm">
                                            <span className="font-mono text-xs text-white/50">
                                                {row.txHash.slice(0, 10)}...{row.txHash.slice(-6)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-sm">
                                            {row.status === "MISSING_IN_DB" ? (
                                                <RecoverPaidTicketButton txHash={row.txHash} />
                                            ) : (
                                                <span className="text-xs text-white/40">Review</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <TicketReconciliationCard />

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
                            <p className="text-white/50 text-sm">Protocol Revenue</p>
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
                                            ) : entry.purchaseSource === "FREE_ADMIN" || entry.purchaseSource === "FREE_PLAYER" ? (
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
