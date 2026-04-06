"use client";

/**
 * LiveGameScreen
 *
 * Clean phase router that delegates all logic to useLiveGame hook.
 * No hooks after the switch statement - just pure rendering.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLiveGame } from "@/hooks/useLiveGame";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import QuestionView from "./_components/QuestionView";
import BreakView from "./_components/BreakView";
import GameCountdownScreen from "./_components/GameCountdownScreen";
import WaitingScreen from "./_components/WaitingScreen";
import { CheerOverlay } from "../../_components/CheerOverlay";
import type { LiveGameData } from "./page";

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function LiveGameScreen({ game }: { game: LiveGameData }) {
  const router = useRouter();
  const {
    state: { entrants },
  } = useRealtime();
  const {
    phase,
    secondsRemaining,
    currentQuestion,
    questionNumber,
    totalQuestions,
    hasAnswered,
    isSubmitting,
    score,
    answerResult,
    streak,
    streakBroken,
    selectedAnswerIndex,
    nextRoundNumber,
    isLastRound,
    gameEndsAt,
    gameId,
    startGame,
    submitAnswer,
    onMediaReady,
  } = useLiveGame(game);

  // Redirect to result page when game is complete
  useEffect(() => {
    if (phase === "complete") {
      router.replace(`/game/${game.id}/result`);
    }
  }, [phase, game.id, router]);

  // ==========================================
  // PHASE-BASED RENDERING
  // No hooks below this point!
  // ==========================================

  switch (phase) {
    case "initializing":
      // Loading entry data - show minimal loader to avoid flash
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      );

    case "countdown":
      return <GameCountdownScreen onComplete={startGame} entrants={entrants} />;

    case "question":
      if (!currentQuestion) {
        // Edge case: no question available
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <p className="font-body text-2xl text-white mb-2">
              NO QUESTIONS LOADED
            </p>
            <p className="font-display text-sm text-white/50">
              The game has no questions or they failed to load.
            </p>
          </div>
        );
      }

      return (
        <>
          <QuestionView
            question={currentQuestion}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            seconds={secondsRemaining}
            onAnswer={submitAnswer}
            hasAnswered={hasAnswered || isSubmitting}
            onMediaReady={onMediaReady}
            answerResult={answerResult}
            streak={streak}
            streakBroken={streakBroken}
            selectedIndex={selectedAnswerIndex}
          />
          <CheerOverlay />
        </>
      );

    case "break":
      return (
        <>
          <div className="flex-1 flex flex-col min-h-0">
            <BreakView
              seconds={secondsRemaining}
              nextRoundNumber={nextRoundNumber}
              isLastRound={isLastRound}
              gameId={game.id}
            />
          </div>
          <CheerOverlay />
        </>
      );

    case "waiting":
      return (
        <>
          <div className="flex-1 flex flex-col min-h-0">
            <WaitingScreen
              score={score}
              gameEndsAt={gameEndsAt}
              gameId={gameId}
            />
          </div>
          <CheerOverlay />
        </>
      );

    case "complete":
      // Redirecting to result page - show loader
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      );
  }
}
