"use client";

import React, { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import { PixelButton } from "@/components/ui/PixelButton";
import type { DemoQuestion } from "@/actions/onboarding";
import confetti from "canvas-confetti";

interface OnboardingOverlayProps {
  onComplete: () => void;
  errorMessage?: string | null;
  demoQuestion?: DemoQuestion | null;
}

const optionColorThemes = ["gold", "purple", "cyan", "green"] as const;

// ============================================
// SLIDE 1: THE PITCH
// ============================================
function PitchSlide({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center w-full px-6 gap-8">
      {/* Hero illustration */}
      <motion.div
        className="relative w-[220px] h-[150px]"
        initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src="/images/illustrations/movie-clapper.png"
          alt="Movie scene"
          fill
          className="object-contain"
          priority
        />
      </motion.div>

      {/* Headline */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2 className="font-body text-white text-center leading-[0.92] tracking-[-0.03em]"
          style={{ fontSize: "clamp(36px, 10vw, 48px)" }}
        >
          GUESS THE SCENE.
          <br />
          <span className="text-waffle-gold">WIN THE POT.</span>
        </h2>
        <p className="font-display text-[15px] leading-[1.4] text-white/50 text-center max-w-[280px]">
          AI-remixed movie scenes. Live arena. Top scorers split the prize pool.
        </p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        className="flex items-center gap-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="flex flex-col items-center">
          <span className="font-body text-waffle-gold text-[22px] leading-none">3x</span>
          <span className="font-display text-[11px] text-white/40 uppercase tracking-[0.1em] mt-1">per week</span>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex flex-col items-center">
          <span className="font-body text-waffle-gold text-[22px] leading-none">TOP 10</span>
          <span className="font-display text-[11px] text-white/40 uppercase tracking-[0.1em] mt-1">split the pot</span>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="flex flex-col items-center">
          <span className="font-body text-waffle-gold text-[22px] leading-none">60s</span>
          <span className="font-display text-[11px] text-white/40 uppercase tracking-[0.1em] mt-1">per question</span>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        className="w-full"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <WaffleButton onClick={onNext} className="w-full max-w-full">
          TRY A QUESTION
        </WaffleButton>
      </motion.div>
    </div>
  );
}

// ============================================
// SLIDE 2: DEMO QUESTION (existing, refined)
// ============================================
function DemoQuestionSlide({
  question,
  onComplete,
}: {
  question: DemoQuestion;
  onComplete: (wasCorrect: boolean) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [btnWidth, setBtnWidth] = useState(296);

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      // 48px accounts for px-4 padding (32px) + extra margin
      setBtnWidth(Math.floor(Math.min(296, w - 48) / 4) * 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleSelect = useCallback(
    (index: number) => {
      if (selectedIndex !== null) return;
      setSelectedIndex(index);

      const isCorrect = index === question.correctIndex;

      if (isCorrect) {
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.5 },
          colors: ["#FFC931", "#14B985", "#1B8FF5"],
        });
      }

      setShowResult(true);

      setTimeout(
        () => onComplete(isCorrect),
        isCorrect ? 1200 : 1500,
      );
    },
    [selectedIndex, onComplete, question.correctIndex],
  );

  const isCorrect =
    selectedIndex !== null && selectedIndex === question.correctIndex;

  return (
    <div className="flex flex-col items-center gap-4 text-center w-full px-4">
      {/* Label */}
      <motion.span
        className="font-display text-[11px] uppercase tracking-[0.18em] text-white/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        Try it — guess the movie
      </motion.span>

      {/* Question */}
      <motion.h2
        className="font-body text-white text-center leading-[0.92] tracking-[-0.03em]"
        style={{ fontSize: "clamp(24px, 7vw, 30px)" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {question.content}
      </motion.h2>

      {/* Media */}
      {question.mediaUrl && (
        <motion.div
          className="relative w-full max-w-[280px] aspect-video rounded-[10px] overflow-hidden bg-card border border-border shadow-[0_8px_0_#000]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Image
            src={question.mediaUrl}
            alt="Guess this movie scene"
            fill
            className="object-cover"
            priority
          />
        </motion.div>
      )}

      {/* Answer options */}
      <motion.ul
        className="flex w-full flex-col gap-3 items-center"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.08, delayChildren: 0.2 },
          },
        }}
      >
        {question.options.map((option, idx) => {
          const hasSelection = selectedIndex !== null;
          const isSelected = selectedIndex === idx;
          const isCorrectOption = idx === question.correctIndex;

          return (
            <motion.li
              key={idx}
              className="flex justify-center"
              variants={{
                hidden: { opacity: 0, y: 15, scale: 0.95 },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { duration: 0.3 },
                },
              }}
              animate={{
                scale:
                  hasSelection && isSelected
                    ? 1.08
                    : hasSelection && showResult && isCorrectOption
                      ? 1.08
                      : 1,
                opacity:
                  hasSelection && !isSelected && !isCorrectOption ? 0.3 : 1,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <PixelButton
                variant="filled"
                colorTheme={optionColorThemes[idx % optionColorThemes.length]}
                width={btnWidth}
                height={48}
                fontSize={14}
                onClick={() => handleSelect(idx)}
                disabled={hasSelection}
              >
                {option}
              </PixelButton>
            </motion.li>
          );
        })}
      </motion.ul>

      {/* Result feedback */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`text-[18px] font-display font-medium ${
              isCorrect ? "text-success" : "text-muted"
            }`}
          >
            {isCorrect ? "You're a natural." : "Not quite — but you get the idea."}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SLIDE 3: THE PAYOFF
// ============================================
function PayoffSlide({
  wasCorrect,
  onComplete,
  isLoading,
  errorMessage,
}: {
  wasCorrect: boolean;
  onComplete: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}) {
  return (
    <div className="flex flex-col items-center w-full px-6 gap-6">
      {/* Trophy / reward visual */}
      <motion.div
        className="relative w-[200px] h-[140px]"
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src="/images/illustrations/treasure-chest.png"
          alt="Prize pool"
          fill
          className="object-contain"
          priority
        />
      </motion.div>

      {/* Payoff copy */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <h2
          className="font-body text-white text-center leading-[0.92] tracking-[-0.03em]"
          style={{ fontSize: "clamp(28px, 8vw, 38px)" }}
        >
          {wasCorrect ? (
            <>
              YOU GOT IT.
              <br />
              <span className="text-waffle-gold">NOW WIN MONEY.</span>
            </>
          ) : (
            <>
              YOU&apos;LL GET IT
              <br />
              <span className="text-waffle-gold">NEXT TIME.</span>
            </>
          )}
        </h2>
        <p className="font-display text-[14px] leading-[1.5] text-white/45 text-center max-w-[300px]">
          {wasCorrect
            ? "Imagine that was worth real money. Buy a ticket, answer fast, and split the pot with the top scorers."
            : "Every game is a new chance. Buy a ticket, guess the scenes, and the top 10 split the prize pool."}
        </p>
      </motion.div>

      {/* How it works — minimal */}
      <motion.div
        className="flex flex-col gap-2 w-full max-w-[300px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {[
          { num: "01", text: "Grab a ticket before spots run out" },
          { num: "02", text: "Answer fast when the game goes live" },
          { num: "03", text: "Top 10 split the prize pool" },
        ].map((step) => (
          <div key={step.num} className="flex items-center gap-3">
            <span className="font-body text-waffle-gold text-[14px] w-6 shrink-0">{step.num}</span>
            <span className="font-display text-[13px] text-white/50 leading-[1.4]">{step.text}</span>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        className="w-full mt-2"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <WaffleButton
          onClick={onComplete}
          disabled={isLoading}
          className="w-full max-w-full"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2" role="status" aria-label="Loading">
              <motion.span
                className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
              />
              LOADING...
            </span>
          ) : (
            "LET'S GO"
          )}
        </WaffleButton>
        {errorMessage && (
          <p className="mt-2 max-w-sm text-center text-sm text-red-300">
            {errorMessage}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ============================================
// PROGRESS INDICATOR
// ============================================
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {[...Array(total)].map((_, i) => (
        <motion.div
          key={i}
          className="h-1.5 rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            backgroundColor:
              i < current
                ? "var(--brand-gold)"
                : i === current
                  ? "var(--brand-gold)"
                  : "rgba(255,255,255,0.2)",
            opacity: i <= current ? 1 : 0.5,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
      ))}
    </div>
  );
}

// ============================================
// MAIN OVERLAY — 3 slides: Pitch → Demo → Payoff
// ============================================
export function OnboardingOverlay({
  onComplete,
  errorMessage = null,
  demoQuestion,
}: OnboardingOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [demoWasCorrect, setDemoWasCorrect] = useState(false);

  const totalSlides = demoQuestion ? 3 : 2; // pitch + (demo?) + payoff

  const goNext = useCallback(() => {
    setDirection(1);
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const handleDemoComplete = useCallback((wasCorrect: boolean) => {
    setDemoWasCorrect(wasCorrect);
    setDirection(1);
    setCurrentSlide((prev) => prev + 1);
  }, []);

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#FFC931", "#14B985", "#1B8FF5"],
      });
      await onComplete();
    } catch {
      setIsLoading(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  // Map slide index to component
  const getSlideKey = () => {
    if (currentSlide === 0) return "pitch";
    if (demoQuestion && currentSlide === 1) return "demo";
    return "payoff";
  };

  const renderSlide = () => {
    if (currentSlide === 0) {
      return <PitchSlide onNext={goNext} />;
    }
    if (demoQuestion && currentSlide === 1) {
      return (
        <DemoQuestionSlide
          question={demoQuestion}
          onComplete={handleDemoComplete}
        />
      );
    }
    return (
      <PayoffSlide
        wasCorrect={demoWasCorrect}
        onComplete={handleFinish}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    );
  };

  return (
    <motion.div
      className="inset-0 z-81 flex flex-col app-background fixed!"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <h1 id="onboarding-title" className="sr-only">Welcome to Waffles</h1>

      {/* Top bar: logo + progress */}
      <motion.div
        className="flex items-center justify-between px-5 pt-4 pb-2 z-10 shrink-0"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="relative w-[100px] h-[20px]">
          <Image
            src="/logo-onboarding.png"
            alt="Waffles"
            fill
            sizes="100px"
            priority
            className="object-contain"
          />
        </div>
        <ProgressDots total={totalSlides} current={currentSlide} />
      </motion.div>

      {/* Slides */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden z-10">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={getSlideKey()}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 200, damping: 28 },
              opacity: { duration: 0.25 },
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {renderSlide()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
