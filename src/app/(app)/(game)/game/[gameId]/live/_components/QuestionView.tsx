"use client";

/**
 * QuestionView
 *
 * Displays a question with tension-style options during live game.
 * Includes progressive pressure (vignette, tremor), speed feedback,
 * streak tracking, and post-answer roast messages.
 */

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { QuestionCardHeader } from "./QuestionCardHeader";
import { QuestionOption } from "./QuestionOption";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import type { LiveGameQuestion } from "../page";
import type { AnswerResult } from "@/lib/game/tension";
import type { QuestionAnswerer } from "@shared/protocol";
import { LucideClover } from "lucide-react";

// ==========================================
// ANIMATION VARIANTS
// ==========================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const questionTextVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

const mediaVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1] as const,
    },
  },
};

const optionContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

// ==========================================
// TENSION SUB-COMPONENTS
// ==========================================

function PressureVignette({ intensity }: { intensity: number }) {
  if (intensity <= 0) return null;

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        background: `radial-gradient(ellipse at center, transparent ${70 - intensity * 30}%, rgba(0,0,0,${intensity * 0.6}) 100%)`,
      }}
      animate={{ opacity: intensity }}
      transition={{ duration: 0.5 }}
    />
  );
}

function AnswererAvatars() {
  const answerers = useRealtime().state.questionAnswerers;
  const [displayed, setDisplayed] = useState<QuestionAnswerer[]>([]);
  const pendingRef = useRef<QuestionAnswerer[]>([]);
  const queuedNamesRef = useRef(new Set<string>());
  const processingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedRef = useRef<QuestionAnswerer[]>([]);

  const getRevealDelay = (isFirstReveal: boolean) =>
    isFirstReveal
      ? 1000 + Math.random() * 1000
      : 800 + Math.random() * 1200;

  useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  useEffect(() => {
    const displayedNames = new Set(displayedRef.current.map((player) => player.username));

    for (const player of answerers) {
      if (displayedNames.has(player.username) || queuedNamesRef.current.has(player.username)) {
        continue;
      }
      pendingRef.current.push(player);
      queuedNamesRef.current.add(player.username);
    }

    const revealNext = () => {
      const next = pendingRef.current.shift();
      if (!next) {
        processingRef.current = false;
        timerRef.current = null;
        return;
      }

      queuedNamesRef.current.delete(next.username);
      setDisplayed((current) => {
        const updated = [...current, next];
        displayedRef.current = updated;
        return updated;
      });

      if (pendingRef.current.length > 0) {
        timerRef.current = setTimeout(revealNext, getRevealDelay(false));
      } else {
        processingRef.current = false;
        timerRef.current = null;
      }
    };

    if (!processingRef.current && pendingRef.current.length > 0) {
      processingRef.current = true;
      const isFirstReveal = displayedRef.current.length === 0;
      timerRef.current = setTimeout(revealNext, getRevealDelay(isFirstReveal));
    }
  }, [answerers]);

  useEffect(() => {
    return () => {
      pendingRef.current = [];
      queuedNamesRef.current.clear();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (displayed.length === 0) return null;

  const visible = displayed.slice(-5);
  const overflow = displayed.length - visible.length;

  return (
    <motion.div
      className="relative mx-4 overflow-hidden"
      style={{ minHeight: 65 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-1.5 justify-center flex-nowrap pr-4">
        <AnimatePresence>
          {visible.map((player) => (
            <motion.div
              key={player.username}
              className="relative overflow-visible"
              style={{ width: 50, height: 50, flexShrink: 0 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              title={player.username}
            >
              <motion.div
                className="absolute inset-0 rounded-[6px]"
                style={{ border: "2px solid rgba(255,255,255,0.45)" }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />

              <div className="w-full h-full rounded-[6px] overflow-hidden bg-gradient-to-br from-waffle-gold-warm to-[#FF6B35]">
                {player.pfpUrl ? (
                  <Image
                    src={player.pfpUrl}
                    alt={player.username}
                    width={50}
                    height={50}
                    className="w-full h-full object-cover"
                    sizes="50px"
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              {player.correct !== null ? (
                <motion.div
                  className="absolute rounded-[4px] flex items-center justify-center"
                  style={{
                    width: 14,
                    height: 14,
                    bottom: -1,
                    right: -1,
                    backgroundColor: player.correct ? "var(--success)" : "var(--danger-soft)",
                    boxShadow: "0 0 0 2px var(--brand-black)",
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 600, damping: 15, delay: 0.2 }}
                >
                  {player.correct ? (
                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 1L7 7M7 1L1 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </motion.div>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>

        {overflow > 0 ? (
          <motion.div
            key={`overflow-${overflow}`}
            className="rounded-[6px] flex items-center justify-center font-body"
            style={{
              width: 50,
              height: 50,
              flexShrink: 0,
              backgroundColor: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              fontSize: overflow >= 10 ? 20 : 22,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
          >
            +{overflow}
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
}

// ==========================================
// PROPS
// ==========================================

interface QuestionViewProps {
  question: LiveGameQuestion;
  questionNumber: number;
  totalQuestions: number;
  seconds: number;
  onAnswer: (selectedIndex: number) => void;
  hasAnswered: boolean;
  onMediaReady?: () => void;
  answerResult: AnswerResult | null;
  streak: number;
  streakBroken: boolean;
  selectedIndex: number | null;
  showAdvancePrompt: boolean;
  onAdvance: () => void;
}

// ==========================================
// COMPONENT
// ==========================================

export default function QuestionView({
  question,
  questionNumber,
  totalQuestions,
  seconds,
  onAnswer,
  hasAnswered,
  onMediaReady,
  answerResult,
  streak,
  streakBroken,
  selectedIndex,
  showAdvancePrompt,
  onAdvance,
}: QuestionViewProps) {
  const [mediaLoaded, setMediaLoaded] = useState(!question.mediaUrl);
  const isLowTime = seconds <= 3 && seconds > 0;
  const isTimeUp = seconds === 0;
  const [buttonWidth, setButtonWidth] = useState(296);

  // Compute button width from screen width
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      setButtonWidth(Math.floor((Math.min(w, 576) - 32) / 4) * 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Notify parent when media is ready
  useEffect(() => {
    if (mediaLoaded && onMediaReady) {
      onMediaReady();
    }
  }, [mediaLoaded, onMediaReady]);

  // Reset mediaLoaded when question changes
  useEffect(() => {
    setMediaLoaded(!question.mediaUrl);
  }, [question.id, question.mediaUrl]);

  const handleSelect = (index: number) => {
    if (hasAnswered) return;
    onAnswer(index);
  };

  // Pressure intensity: 0 at >5s, ramps to 1 at 0s
  const pressure =
    !hasAnswered && seconds <= 5 ? 1 - seconds / 5 : 0;
  // Tremor: 0 until 4s, ramps to 3px at 0s
  const tremor =
    !hasAnswered && seconds <= 4 ? (1 - seconds / 4) * 3 : 0;

  const isTimeout = answerResult?.speedTier === "timeout";

  return (
    <motion.div
      className="w-full max-w-xl mx-auto flex-1 flex flex-col relative"
      variants={containerVariants}
      initial="hidden"
      animate={
        isTimeout
          ? { opacity: 1, x: [0, -6, 6, -4, 4, -2, 2, 0], y: [0, 3, -3, 2, -2, 1, -1, 0] }
          : "visible"
      }
      transition={isTimeout ? { duration: 0.4 } : undefined}
      key={question.id}
    >
      {/* Pressure vignette overlay */}
      <PressureVignette intensity={pressure} />

      {/* Header with timer + streak */}
      <QuestionCardHeader
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        remaining={seconds}
        duration={question.durationSec}
        streak={streak}
        streakBroken={streakBroken}
      />

      <section className="w-full flex flex-col relative" aria-live="polite">
        {/* Question Content with urgency glow */}
        <motion.div
          className="relative mx-auto mb-4 flex items-center justify-center w-full font-body font-normal leading-[0.92] text-center tracking-[-0.03em] text-white px-4"
          style={{ fontSize: "clamp(24px, 7vw, 34px)" }}
          variants={questionTextVariants}
          animate={
            isLowTime
              ? {
                  textShadow: [
                    "0 0 0px rgba(255,68,68,0)",
                    "0 0 25px rgba(255,68,68,0.5)",
                    "0 0 0px rgba(255,68,68,0)",
                  ],
                }
              : {}
          }
          transition={
            isLowTime
              ? { textShadow: { duration: 0.6, repeat: Infinity } }
              : undefined
          }
        >
          {question.content}
        </motion.div>

        {/* Media with spring entrance */}
        <AnimatePresence>
          {question.mediaUrl && (
            <motion.figure
              className="mx-auto mb-4 flex justify-center w-full px-4"
              variants={mediaVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            >
              <div className="relative w-full aspect-video rounded-[10px] overflow-hidden bg-card border border-border shadow-[0_8px_0_#000]">
                {!mediaLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-card">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                <Image
                  src={question.mediaUrl}
                  alt={question.content}
                  fill
                  className={`object-cover transition-opacity duration-300 ${
                    mediaLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  sizes="(max-width: 640px) 100vw, 500px"
                  priority
                  loading="eager"
                  quality={80}
                  onLoad={() => setMediaLoaded(true)}
                />
              </div>
            </motion.figure>
          )}
        </AnimatePresence>

        <motion.ul
          className={`w-full flex flex-col gap-3 px-4 ${
            answerResult ? "pb-24" : ""
          }`}
          variants={optionContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {question.options.map((opt, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.35,
                delay: 0.3 + idx * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <QuestionOption
                option={opt}
                index={idx}
                selectedOptionIndex={selectedIndex}
                onSelect={handleSelect}
                disabled={hasAnswered || isTimeUp}
                tremor={tremor}
                speedTier={answerResult?.speedTier ?? null}
                buttonWidth={buttonWidth}
              />
            </motion.div>
          ))}
        </motion.ul>

        {/* Real-time answerers — below options so they don't push options down */}
        <AnimatePresence>
          <AnswererAvatars />
        </AnimatePresence>

        {/* Post-answer feedback overlay */}
        <AnimatePresence>
          {answerResult && (
            <motion.div
              className="sticky bottom-0 left-0 right-0 px-4 pb-4 pt-3 flex flex-col items-center gap-3 z-20"
              style={{
                background: "linear-gradient(to top, var(--brand-black) 60%, transparent 100%)",
              }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <motion.p
                className="font-body text-lg text-center"
                style={{ color: answerResult.feedback.color }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {answerResult.feedback.text}
              </motion.p>
              {showAdvancePrompt ? (
                <motion.button
                  className="w-full max-w-sm py-3.5 rounded-xl bg-white/10 border border-white/20 font-body text-lg text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-gold)]"
                  onClick={onAdvance}
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.15)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  {questionNumber >= totalQuestions ? "SEE RESULTS" : "NEXT QUESTION"}
                </motion.button>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
