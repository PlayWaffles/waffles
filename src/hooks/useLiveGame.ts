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
import {
  getSpeedTier,
  getAnswerFeedback,
  getTimeoutFeedback,
  resetFeedbackMessages,
  type AnswerResult,
} from "@/lib/game/tension";
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

  // Tension feedback (set after answer, cleared on next question)
  answerResult: AnswerResult | null;
  streak: number;
  streakBroken: boolean;
  selectedAnswerIndex: number | null;

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

  // Tension feedback state
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakBroken, setStreakBroken] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    // Clear feedback state for the next question
    setAnswerResult(null);
    setSelectedAnswerIndex(null);
    setStreakBroken(false);

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
        const result = await submitAnswerToServer(
          game.id,
          currentQuestion.id,
          -1,
          timeMs,
        );
        if (result.success) {
          setEntry((currentEntry) =>
            currentEntry
              ? {
                  score: result.totalScore,
                  answered: currentEntry.answered + 1,
                  answeredQuestionIds: [...currentEntry.answeredQuestionIds, currentQuestion.id],
                }
              : currentEntry,
          );
          void refetchEntry();
        }
        setIsSubmitting(false);

        // Show timeout feedback, then advance
        const feedback = getTimeoutFeedback();
        setAnswerResult({
          isCorrect: false,
          speedTier: "timeout",
          feedback,
          pointsEarned: 0,
        });
        setStreakBroken(streak >= 2);
        setStreak(0);
        feedbackTimerRef.current = setTimeout(advanceToNext, 2000);
        return;
      }

      // Already answered — feedback timer is running, or advance now
      if (!feedbackTimerRef.current) {
        advanceToNext();
      }
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

  // Stop all sound effects and clear feedback timer when question changes or phase ends
  useEffect(() => {
    return () => {
      stopAllAudio();
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [currentQuestion?.id, phase]);

  // Set current question in context and backfill answerers from DB
  useEffect(() => {
    let cancelled = false;

    if (phase === "question" && game.questions[currentQuestionIndex]) {
      const questionId = game.questions[currentQuestionIndex].id;
      dispatch({
        type: "SET_CURRENT_QUESTION",
        payload: questionId,
      });

      // Backfill answerers from DB (non-blocking)
      authenticatedFetch(
        `/api/v1/games/${game.id}/answerers?questionId=${questionId}`,
      )
        .then((res) => (res.ok ? res.json() : []))
        .then((players: { username: string; pfpUrl: string | null }[]) => {
          if (!cancelled && players.length > 0) {
            dispatch({
              type: "SEED_ANSWERERS",
              payload: {
                questionId,
                players: players.map((p) => ({
                  username: p.username,
                  pfpUrl: p.pfpUrl,
                  timestamp: Date.now(),
                })),
              },
            });
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [currentQuestionIndex, phase, dispatch, game.questions, game.id]);

  // ==========================================
  // ACTIONS
  // ==========================================

  const startGame = useCallback(() => {
    if (phase !== "countdown") return;

    // Reset feedback messages for the new game session
    resetFeedbackMessages();

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

      setSelectedAnswerIndex(selectedIndex);
      setIsSubmitting(true);
      const timeMs = Date.now() - questionStartRef.current;

      // Submit to server
      const result = await submitAnswerToServer(
        game.id,
        currentQuestion.id,
        selectedIndex,
        timeMs,
      );
      if (result.success) {
        setEntry((currentEntry) =>
          currentEntry
            ? {
                score: result.totalScore,
                answered: currentEntry.answered + 1,
                answeredQuestionIds: [...currentEntry.answeredQuestionIds, currentQuestion.id],
              }
            : currentEntry,
        );
        void refetchEntry();
      }

      // Compute tension feedback
      const speedTier = getSpeedTier(timeMs, currentQuestion.durationSec);
      const isCorrect = result.success && result.isCorrect;
      const newStreak = isCorrect ? streak + 1 : 0;
      const wasBroken = !isCorrect && streak >= 2;

      setStreakBroken(wasBroken);
      setStreak(newStreak);
      const feedback = getAnswerFeedback(speedTier, newStreak, isCorrect);
      setAnswerResult({
        isCorrect,
        speedTier,
        feedback,
        pointsEarned: result.pointsEarned,
      });

      setIsSubmitting(false);

      // Show feedback for 2s, then advance
      feedbackTimerRef.current = setTimeout(() => {
        feedbackTimerRef.current = null;
        advanceToNext();
      }, 2000);
    },
    [
      game.id,
      currentQuestion,
      hasAnswered,
      isSubmitting,
      streak,
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
    answerResult,
    streak,
    streakBroken,
    selectedAnswerIndex,
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
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
}

async function submitAnswerToServer(
  gameId: string,
  questionId: string,
  selectedIndex: number,
  timeMs: number,
  retries = 3,
): Promise<SubmitResult> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await authenticatedFetch(`/api/v1/games/${gameId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          selectedIndex,
          timeTakenMs: timeMs,
        }),
      });
      const result = (await response.json()) as
        | { success: true; isCorrect: boolean; pointsEarned: number; totalScore: number }
        | { success: false; error: string };

      if (result.success) {
        return {
          success: true,
          isCorrect: result.isCorrect,
          pointsEarned: result.pointsEarned,
          totalScore: result.totalScore,
        };
      }
    } catch (e) {
      console.error(`Answer submit failed (attempt ${i + 1}):`, e);
    }
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  return { success: false, isCorrect: false, pointsEarned: 0, totalScore: 0 };
}
