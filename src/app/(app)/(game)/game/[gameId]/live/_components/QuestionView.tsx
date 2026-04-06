"use client";

/**
 * QuestionView
 *
 * Displays a question with tension-style options during live game.
 * Includes progressive pressure (vignette, tremor), speed feedback,
 * streak tracking, and post-answer roast messages.
 */

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { QuestionCardHeader } from "./QuestionCardHeader";
import { QuestionOption } from "./QuestionOption";
import { playSound } from "@/lib/sounds";
import { PlayerAvatarStack } from "../../../_components/PlayerAvatarStack";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import type { LiveGameQuestion } from "../page";
import type { AnswerResult } from "@/lib/game/tension";

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
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
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
}: QuestionViewProps) {
  const [mediaLoaded, setMediaLoaded] = useState(!question.mediaUrl);
  const answerers = useRealtime().state.questionAnswerers;
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
    playSound("answerSubmit");
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
      className="w-full max-w-lg mx-auto mt-2 relative"
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

      <section className="mx-auto w-full max-w-lg px-4 relative" aria-live="polite">
        {/* Question Content with urgency glow */}
        <motion.div
          className="relative mx-auto mb-4 flex items-center justify-center w-full max-w-[306px] font-body font-normal text-[36px] leading-[0.92] text-center tracking-[-0.03em] text-white"
          variants={questionTextVariants}
          animate={
            isLowTime
              ? {
                  textShadow: [
                    "0 0 0px rgba(255,107,107,0)",
                    "0 0 20px rgba(255,107,107,0.6)",
                    "0 0 0px rgba(255,107,107,0)",
                  ],
                }
              : {}
          }
          transition={
            isLowTime ? { duration: 0.8, repeat: Infinity } : undefined
          }
        >
          {question.content}
        </motion.div>

        {/* Media with spring entrance */}
        <AnimatePresence>
          {question.mediaUrl && (
            <motion.figure
              className="mx-auto mb-4 flex justify-center w-full"
              variants={mediaVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            >
              <div className="relative w-full aspect-video rounded-[10px] overflow-hidden bg-[#17171a] border border-[#313136] shadow-[0_8px_0_#000]">
                {!mediaLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#17171a]">
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

        {/* Real-time answerers — between question/media and options */}
        <AnimatePresence>
          {answerers.length > 0 && (
            <motion.div
              key="answerers"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              className="mb-3"
            >
              <motion.div
                key={answerers.length}
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 0.3 }}
              >
                <PlayerAvatarStack actionText="just answered" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Options with tension effects */}
        <motion.ul
          className="mx-auto mb-2 flex w-full flex-col gap-2"
          variants={optionContainerVariants}
        >
          {question.options.map((opt, idx) => (
            <QuestionOption
              key={idx}
              option={opt}
              index={idx}
              selectedOptionIndex={selectedIndex}
              onSelect={handleSelect}
              disabled={hasAnswered || isTimeUp}
              tremor={tremor}
              speedTier={answerResult?.speedTier ?? null}
              buttonWidth={buttonWidth}
            />
          ))}
        </motion.ul>

        {/* Post-answer feedback overlay */}
        <AnimatePresence>
          {answerResult && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex flex-col items-center gap-2 z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <motion.p
                className="font-body text-lg"
                style={{ color: answerResult.feedback.color }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {answerResult.feedback.text}
              </motion.p>
              {answerResult.pointsEarned > 0 && (
                <motion.p
                  className="font-display text-sm text-white/60"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  +{answerResult.pointsEarned.toLocaleString()} pts
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeout feedback (no selection made) */}
        <AnimatePresence>
          {!answerResult && isTimeUp && selectedIndex === null && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex flex-col items-center z-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <motion.p
                className="font-body text-lg text-[#FF4444]"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                TIME&apos;S UP
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
