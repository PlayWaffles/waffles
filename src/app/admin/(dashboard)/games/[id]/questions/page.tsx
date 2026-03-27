import { prisma } from "@/lib/db";
import Link from "next/link";
import { QuestionsManager } from "@/components/admin/QuestionsManager";
import { QuestionImport } from "@/components/admin/QuestionImport";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, DocumentTextIcon, ArrowUpTrayIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { formatAdminGameLabel } from "@/lib/game/labels";

export default async function GameQuestionsPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ warning?: string }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const gameId = resolvedParams.id;
    const warning = resolvedSearchParams.warning;

    const gameData = await prisma.game.findUnique({
        where: { id: gameId },
    });

    if (!gameData) {
        notFound();
    }

    const questions = await prisma.question.findMany({
        where: { gameId: gameData.id },
        orderBy: { roundIndex: "asc" },
    });

    const game = { ...gameData, questions };



    const totalQuestions = game.questions.length;

    return (
        <div className="max-w-5xl mx-auto space-y-6 font-display">
            {/* Warning Banner */}
            {warning && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                    <span className="text-sm">
                        Game created, but: <strong>{warning}</strong>
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href={`/admin/games/${game.id}`}
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-white font-display">Questions</h1>
                    <p className="text-sm text-white/50">
                        {formatAdminGameLabel(game.title, game.platform)} • <span className="text-[#FFC931]">{totalQuestions}</span> questions
                    </p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Questions List - Main Area */}
                <div className="lg:col-span-3">
                    <div className="bg-linear-to-br from-[#FFC931]/5 to-transparent rounded-2xl border border-white/10 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <DocumentTextIcon className="h-5 w-5 text-[#FFC931]" />
                                <h2 className="font-semibold text-white">All Questions</h2>
                            </div>
                            <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">
                                Drag to reorder
                            </span>
                        </div>
                        <QuestionsManager gameId={game.id} initialQuestions={game.questions} />
                    </div>
                </div>

                {/* Sidebar - Bulk Import */}
                <div className="lg:col-span-2">
                    <div className="bg-linear-to-br from-[#FB72FF]/5 to-transparent rounded-2xl border border-white/10 p-4 sticky top-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ArrowUpTrayIcon className="h-5 w-5 text-[#FB72FF]" />
                            <h2 className="font-semibold text-white">Bulk Import</h2>
                        </div>
                        <p className="text-sm text-white/40 mb-4">
                            Upload a CSV file to add multiple questions at once.
                        </p>
                        <QuestionImport gameId={game.id} />
                    </div>
                </div>
            </div>
        </div>
    );
}


