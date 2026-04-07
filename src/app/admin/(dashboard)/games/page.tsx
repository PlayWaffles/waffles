import { prisma } from "@/lib/db";
import Link from "next/link";
import { GameFilters } from "@/components/admin/GameFilters";
import { GameRow } from "@/components/admin/GameRow";
import { PlusIcon } from "@heroicons/react/24/outline";
import { getGamePhase, type GamePhase } from "@/lib/types";
import { UserPlatform } from "@prisma";
import { buildAdminGameWhere } from "@/lib/admin-utils";

// Phase filtering using time-based logic
const VALID_PHASES: GamePhase[] = ["SCHEDULED", "LIVE", "ENDED"];

async function getGames(searchParams: { search?: string; status?: string; platform?: string }) {
    const where: Record<string, unknown> = buildAdminGameWhere();
    const now = new Date();

    if (searchParams.search) {
        where.title = {
            contains: searchParams.search,
            mode: "insensitive",
        };
    }

    if (
        searchParams.platform &&
        Object.values(UserPlatform).includes(searchParams.platform as UserPlatform)
    ) {
        where.platform = searchParams.platform;
    }

    // Filter by phase using time-based logic
    if (searchParams.status && VALID_PHASES.includes(searchParams.status as GamePhase)) {
        const phase = searchParams.status as GamePhase;
        if (phase === "LIVE") {
            where.startsAt = { lte: now };
            where.endsAt = { gt: now };
        } else if (phase === "ENDED") {
            where.endsAt = { lte: now };
        } else if (phase === "SCHEDULED") {
            where.startsAt = { gt: now };
        }
    }

    return prisma.game.findMany({
        where,
        take: 100,
        orderBy: [{ startsAt: "desc" }],
        select: {
            id: true,
            platform: true,
            title: true,
            theme: true,
            startsAt: true,
            endsAt: true,
            playerCount: true,
            prizePool: true,
            tierPrices: true,
            maxPlayers: true,
            isTestnet: true,
            _count: {
                select: {
                    questions: true,
                    entries: true,
                },
            },
        },
    });
}

export default async function GamesListPage({
    searchParams,
}: {
    searchParams: Promise<{ search?: string; status?: string; platform?: string }>;
}) {
    const resolvedParams = await searchParams;
    const games = await getGames(resolvedParams);

    // Add phase to each game for display
    const gamesWithPhase = games.map(game => ({
        ...game,
        phase: getGamePhase(game),
    }));

    return (
        <div className="space-y-6 font-display">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white font-display">Games</h1>
                    <p className="text-white/60 mt-1">Manage game sessions and questions</p>
                </div>
                <Link
                    href="/admin/games/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-[#FFC931] hover:bg-[#FFD966] shadow-lg shadow-[#FFC931]/20 transition-all duration-200 hover:shadow-[#FFC931]/30 font-display"
                >
                    <PlusIcon className="h-4 w-4" />
                    Create Game
                </Link>
            </div>

            <GameFilters />

            <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Game
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Starts At
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Participants
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Questions
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-white/50 uppercase tracking-wider font-display">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {gamesWithPhase.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                                                <span className="text-3xl">🎮</span>
                                            </div>
                                            <p className="text-lg font-medium text-white mb-1 font-display">No games found</p>
                                            <p className="text-sm text-white/50">
                                                Try adjusting your filters or create a new game.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                gamesWithPhase.map((game) => <GameRow key={game.id} game={game} />)
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
