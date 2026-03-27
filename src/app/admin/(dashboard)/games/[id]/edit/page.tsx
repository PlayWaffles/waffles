import { prisma } from "@/lib/db";
import { updateGameAction } from "@/actions/admin/games";
import { GameForm } from "@/components/admin/GameForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const game = await prisma.game.findUnique({
        where: { id },
        select: {
            id: true,
            platform: true,
            title: true,
            description: true,
            theme: true,
            coverUrl: true,
            startsAt: true,
            endsAt: true,
            tierPrices: true,
            prizePool: true,
            roundBreakSec: true,
            maxPlayers: true,
        },
    });

    if (!game) {
        notFound();
    }

    // Transform to form data shape
    const formData = {
        platform: game.platform,
        title: game.title,
        description: game.description,
        theme: game.theme,
        coverUrl: game.coverUrl,
        startsAt: game.startsAt,
        endsAt: game.endsAt,
        tierPrices: game.tierPrices,
        prizePool: game.prizePool,
        roundBreakSec: game.roundBreakSec,
        maxPlayers: game.maxPlayers,
    };

    return (
        <div className="max-w-7xl space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href={`/admin/games/${game.id}`}
                    className="text-white/50 hover:text-[#FFC931] font-medium transition-colors"
                >
                    ← Back
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-white font-display">Edit Game</h1>
                    <p className="text-white/60 mt-1">Update game details for <span className="text-[#FFC931]">{game.title}</span></p>
                </div>
            </div>

            <GameForm
                action={updateGameAction.bind(null, game.id)}
                initialData={formData}
                isEdit={true}
            />
        </div>
    );
}
