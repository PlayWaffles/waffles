"use client";

/**
 * useLiveGame Hook
 *
 * Single source of truth for live game state.
 * Uses state machine pattern with clear phases:
 * COUNTDOWN → QUESTION → BREAK → QUESTION → ... → COMPLETE
 *
 * All hooks are called unconditionally at the top level.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTimer } from "@/hooks/useTimer";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import { playSound, stopAllAudio } from "@/lib/sounds";
import { useUser } from "@/hooks/useUser";
import { authenticatedFetch } from "@/lib/client/runtime";
import type {
  LiveGameData,
  LiveGameQuestion,
} from "@/app/(app)/(game)/game/[gameId]/live/page";

// ==========================================
// TYPES
// ==========================================

export type GamePhase =
  | "initializing" // Waiting for entry data to determine correct starting phase
  | "countdown"
  | "question"
  | "break"
  | "waiting"
  | "complete";

export interface UseLiveGameReturn {
  // Current phase
  phase: GamePhase;

  // Timer
  secondsRemaining: number;

  // Question state (only valid in 'question' phase)
  currentQuestion: LiveGameQuestion | null;
  questionNumber: number;
  totalQuestions: number;

  // Answer state
  hasAnswered: boolean;
  isSubmitting: boolean;
  score: number;

  // Break state
  nextRoundNumber: number;
  isLastRound: boolean;

  // Waiting state - for showing countdown until game ends
  gameEndsAt: Date;
  gameId: string;

  // Actions
  startGame: () => void;
  submitAnswer: (index: number) => Promise<void>;
  onMediaReady: () => void;
}

// ==========================================
// HOOK
// ==========================================

export function useLiveGame(game: LiveGameData): UseLiveGameReturn {
  const { dispatch } = useRealtime();
  const { user } = useUser();

  // ==========================================
  // ALL HOOKS DECLARED UNCONDITIONALLY HERE
  // ==========================================

  // Local entry state (fetched separately since entry is per-game)
  const [entry, setEntry] = useState<{
    score: number;
    answered: number;
    answeredQuestionIds: string[];
  } | null>(null);

  // Track if initial entry fetch is complete (determines when we can pick starting phase)
  const [entryLoaded, setEntryLoaded] = useState(false);

  // Fetch entry from server using the authenticated session
  const refetchEntry = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await authenticatedFetch(`/api/v1/games/${game.id}/entry`);
      if (res.ok) {
        const data = await res.json();
        setEntry({
          score: data.score ?? 0,
          answered: data.answered ?? 0,
          answeredQuestionIds: data.answeredQuestionIds ?? [],
        });
      }
    } catch (err) {
      console.error("[useLiveGame] Failed to fetch entry:", err);
    }
  }, [game.id, user?.id]);

  // Initial fetch - marks entryLoaded when complete
  useEffect(() => {
    let mounted = true;

    async function loadEntry() {
      await refetchEntry();
      if (mounted) {
        setEntryLoaded(true);
      }
    }

    loadEntry();
    return () => {
      mounted = false;
    };
  }, [refetchEntry]);

  // Core state - start with "initializing" to avoid flash of wrong screen
  const [phase, setPhase] = useState<GamePhase>("initializing");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timerTarget, setTimerTarget] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);

  // Refs
  const questionStartRef = useRef(Date.now());
  const prevSecondsRef = useRef(0);

  // ==========================================
  // DERIVED STATE (useMemo for stability)
  // ==========================================

  const answeredIds = useMemo(
    () => new Set(entry?.answeredQuestionIds ?? []),
    [entry?.answeredQuestionIds],
  );

  const score = entry?.score ?? 0;

  const currentQuestion = useMemo(
    () => game.questions[currentQuestionIndex] ?? null,
    [game.questions, currentQuestionIndex],
  );

  const hasAnswered = useMemo(
    () => (currentQuestion ? answeredIds.has(currentQuestion.id) : false),
    [currentQuestion, answeredIds],
  );

  // Check if user has already completed all questions
  const hasCompletedAllQuestions = useMemo(
    () => answeredIds.size >= game.questions.length,
    [answeredIds.size, game.questions.length],
  );

  const isGameEnded = Date.now() >= game.endsAt.getTime();

  // Determine correct starting phase once entry is loaded
  // This runs only once when transitioning out of "initializing"
  useEffect(() => {
    if (phase !== "initializing" || !entryLoaded) return;

    // Determine the correct starting phase based on game state
    if (isGameEnded) {
      setPhase("complete");
    } else if (hasCompletedAllQuestions) {
      // User already answered all questions - go straight to waiting
      setPhase("waiting");
    } else {
      // Show countdown to start the game
      setPhase("countdown");
    }
  }, [phase, entryLoaded, isGameEnded, hasCompletedAllQuestions]);

  // Auto-transition from waiting to complete when game ends
  useEffect(() => {
    if (phase !== "waiting") return;

    const timeUntilEnd = game.endsAt.getTime() - Date.now();
    if (timeUntilEnd <= 0) {
      setPhase("complete");
      return;
    }

    // Set timer to auto-transition when game ends
    const timer = setTimeout(() => {
      setPhase("complete");
    }, timeUntilEnd);

    return () => clearTimeout(timer);
  }, [phase, game.endsAt]);

  const nextRoundNumber = useMemo(() => {
    const nextQ = game.questions[currentQuestionIndex + 1];
    return nextQ?.roundIndex ?? 1;
  }, [game.questions, currentQuestionIndex]);

  // Check if the next round is the last one
  const isLastRound = useMemo(() => {
    const nextQ = game.questions[currentQuestionIndex + 1];
    if (!nextQ) return true;
    // Check if any question after this one has a different round
    const hasMoreRoundsAfter = game.questions
      .slice(currentQuestionIndex + 2)
      .some((q) => q.roundIndex !== nextQ.roundIndex);
    return !hasMoreRoundsAfter;
  }, [game.questions, currentQuestionIndex]);

  // ==========================================
  // GAME LOGIC
  // ==========================================

  const advanceToNext = useCallback(() => {
    // Stop any playing sound effects before transitioning
    stopAllAudio();

    const nextIdx = currentQuestionIndex + 1;

    // Game complete?
    if (nextIdx >= game.questions.length || isGameEnded) {
      setPhase("complete");
      return;
    }

    const current = game.questions[currentQuestionIndex];
    const next = game.questions[nextIdx];

    // Round break?
    if (current && next && current.roundIndex !== next.roundIndex) {
      setPhase("break");
      setTimerTarget(Date.now() + game.roundBreakSec * 1000);
      return;
    }

    // Move to next question
    setCurrentQuestionIndex(nextIdx);
    setMediaReady(false);
    setPhase("question");
  }, [currentQuestionIndex, game.questions, game.roundBreakSec, isGameEnded]);

  // ==========================================
  // TIMER EXPIRY HANDLER
  // ==========================================

  const handleTimerExpiry = useCallback(async () => {
    if (phase === "break") {
      // Stop any playing sounds before transitioning
      stopAllAudio();

      // Move to next question after break
      const nextIdx = currentQuestionIndex + 1;
      if (nextIdx >= game.questions.length || isGameEnded) {
        setPhase("complete");
      } else {
        setCurrentQuestionIndex(nextIdx);
        setMediaReady(false);
        setPhase("question");
      }
      return;
    }

    if (phase === "question") {
      // Auto-submit timeout if not answered
      if (!hasAnswered && !isSubmitting && currentQuestion) {
        setIsSubmitting(true);
        const timeMs = currentQuestion.durationSec * 1000;
        await submitAnswerToServer(
          game.id,
          currentQuestion.id,
          -1,
          timeMs,
        );
        await refetchEntry();
        setIsSubmitting(false);
      }

      // Move to next question or break
      advanceToNext();
    }
  }, [
    phase,
    currentQuestionIndex,
    game.questions.length,
    game.id,
    isGameEnded,
    hasAnswered,
    isSubmitting,
    currentQuestion,
    refetchEntry,
    advanceToNext,
  ]);

  // ==========================================
  // TIMER
  // ==========================================

  const seconds = useTimer(timerTarget, handleTimerExpiry);

  // Sound effects for timer warnings
  useEffect(() => {
    if (phase !== "question") return;

    if (prevSecondsRef.current > 3 && seconds === 3) {
      playSound("timerFinal");
    }
    if (prevSecondsRef.current > 0 && seconds === 0) {
      playSound("timeUp");
    }
    prevSecondsRef.current = seconds;
  }, [seconds, phase]);

  // Stop all sound effects when question changes or phase ends
  useEffect(() => {
    // Cleanup on question change or unmount
    return () => {
      stopAllAudio();
    };
  }, [currentQuestion?.id, phase]);

  // Set current question in context (for real-time answerer filtering)
  useEffect(() => {
    if (phase === "question" && game.questions[currentQuestionIndex]) {
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: game.questions[currentQuestionIndex].id,
      });
    }
  }, [currentQuestionIndex, phase, dispatch, game.questions]);

  // ==========================================
  // ACTIONS
  // ==========================================

  const startGame = useCallback(() => {
    if (phase !== "countdown") return;

    // Find first unanswered question
    const firstUnansweredIdx = game.questions.findIndex(
      (q) => !answeredIds.has(q.id),
    );

    if (firstUnansweredIdx === -1) {
      // All questions answered - go to waiting screen if game still live
      if (isGameEnded) {
        setPhase("complete");
      } else {
        setPhase("waiting");
      }
      return;
    }

    setCurrentQuestionIndex(firstUnansweredIdx);
    setMediaReady(false);
    setPhase("question");
  }, [phase, game.questions, answeredIds, isGameEnded]);

  const submitAnswer = useCallback(
    async (selectedIndex: number) => {
      if (!currentQuestion || hasAnswered || isSubmitting) return;

      setIsSubmitting(true);
      const timeMs = Date.now() - questionStartRef.current;

      // Submit to server
      await submitAnswerToServer(
        game.id,
        currentQuestion.id,
        selectedIndex,
        timeMs,
      );
      await refetchEntry();

      setIsSubmitting(false);
      advanceToNext();
    },
    [
      game.id,
      currentQuestion,
      hasAnswered,
      isSubmitting,
      refetchEntry,
      advanceToNext,
    ],
  );

  const onMediaReady = useCallback(() => {
    if (!mediaReady && currentQuestion && phase === "question") {
      setMediaReady(true);
      questionStartRef.current = Date.now();
      setTimerTarget(Date.now() + currentQuestion.durationSec * 1000);
    }
  }, [mediaReady, currentQuestion, phase]);

  // ==========================================
  // RETURN
  // ==========================================

  return {
    phase,
    secondsRemaining: mediaReady
      ? seconds
      : (currentQuestion?.durationSec ?? 0),
    currentQuestion,
    questionNumber: currentQuestionIndex + 1,
    totalQuestions: game.questions.length,
    hasAnswered,
    isSubmitting,
    score,
    nextRoundNumber,
    isLastRound,
    gameEndsAt: game.endsAt,
    gameId: game.id,
    startGame,
    submitAnswer,
    onMediaReady,
  };
}

// ==========================================
// API HELPER
// ==========================================

interface SubmitResult {
  success: boolean;
  pointsEarned: number;
}

async function submitAnswerToServer(
  gameId: string,
  questionId: string,
  selectedIndex: number,
  timeMs: number,
  retries = 3,
): Promise<SubmitResult> {
  // Import dynamically to avoid circular dependencies
  const { submitAnswer } = await import("@/actions/game");

  for (let i = 0; i < retries; i++) {
    try {
      const result = await submitAnswer({
        gameId,
        questionId,
        selectedIndex,
        timeTakenMs: timeMs,
      });
      if (result.success) {
        return { success: true, pointsEarned: result.pointsEarned };
      }
    } catch (e) {
      console.error(`Answer submit failed (attempt ${i + 1}):`, e);
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  return { success: false, pointsEarned: 0 };
}
