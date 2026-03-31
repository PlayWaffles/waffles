"use client";

import React, { useState, useCallback } from "react";
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

interface InfoSlide {
  icon: string;
  title: string;
  description: React.ReactNode;
}

const optionColorThemes = ["gold", "purple", "cyan", "green"] as const;

const infoSlides: InfoSlide[] = [
  {
    icon: "/images/illustrations/movie-clapper.png",
    title: "Guess the Scene",
    description: (
      <>
        Watch movie clips and guess the film.
        <br />
        The faster you answer, the more points you score.
      </>
    ),
  },
  {
    icon: "/images/illustrations/two-tickets.png",
    title: "Free or Paid",
    description: (
      <>
        Play for free just for fun, or grab a $1
        <br />
        ticket to compete for the prize pool.
      </>
    ),
  },
  {
    icon: "/images/illustrations/treasure-chest.png",
    title: "Win Real Prizes",
    description: (
      <>
        Top scorers split the pot. The faster and
        <br />
        more accurate you are, the bigger your share.
      </>
    ),
  },
  {
    icon: "/images/illustrations/play-live.png",
    title: "Play Live",
    description: (
      <>
        Games run on a live timer. Chat, cheer,
        <br />
        and compete with others in real-time.
      </>
    ),
  },
];

type Slide = { type: "info"; data: InfoSlide } | { type: "demo" };

function buildSlides(hasDemoQuestion: boolean): Slide[] {
  const slides: Slide[] = [{ type: "info", data: infoSlides[0] }];
  if (hasDemoQuestion) {
    slides.push({ type: "demo" });
  }
  for (let i = 1; i < infoSlides.length; i++) {
    slides.push({ type: "info", data: infoSlides[i] });
  }
  return slides;
}

// ============================================
// FLOATING PARTICLES - Subtle background
// ============================================
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3 + (i % 2) * 2,
            height: 3 + (i % 2) * 2,
            background: "rgba(251, 191, 36, 0.3)",
            left: `${10 + i * 10}%`,
            top: `${20 + (i % 4) * 20}%`,
          }}
          animate={{
            y: [0, -25, 0],
            opacity: [0.15, 0.4, 0.15],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        />
      ))}

      {/* Single subtle glow */}
      <div
        className="absolute w-64 h-64 rounded-full blur-3xl opacity-10"
        style={{
          background: "radial-gradient(circle, #FFC931 0%, transparent 70%)",
          top: "30%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
}

// ============================================
// PROGRESS DOTS
// ============================================
function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center mt-4">
      {[...Array(total)].map((_, i) => (
        <motion.div
          key={i}
          className="h-2 rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            backgroundColor:
              i === current ? "#FFC931" : "rgba(255,255,255,0.25)",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
      ))}
    </div>
  );
}

// ============================================
// DEMO QUESTION SLIDE
// ============================================
function DemoQuestionSlide({
  question,
  onComplete,
}: {
  question: DemoQuestion;
  onComplete: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

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
          colors: ["#FFC931", "#4CAF50", "#3B82F6"],
        });
      }

      setShowResult(true);

      // Auto-advance after showing result
      setTimeout(
        () => {
          onComplete();
        },
        isCorrect ? 1200 : 1500,
      );
    },
    [selectedIndex, onComplete],
  );

  const isCorrect =
    selectedIndex !== null && selectedIndex === question.correctIndex;

  return (
    <div className="flex flex-col items-center gap-4 text-center w-full px-4">
      {/* Question */}
      <motion.h2
        className="text-[28px] text-white font-normal text-center leading-[0.92] tracking-[-0.03em] font-body"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {question.content}
      </motion.h2>

      {/* Media */}
      {question.mediaUrl && (
        <motion.div
          className="relative w-full max-w-[280px] aspect-video rounded-[10px] overflow-hidden bg-[#17171a] border border-[#313136] shadow-[0_8px_0_#000]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Image
            src={question.mediaUrl}
            alt="Demo question"
            fill
            className="object-cover"
            priority
          />
        </motion.div>
      )}

      {/* Answer options */}
      <motion.ul
        className="flex w-full flex-col gap-2 items-center"
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
                width={296}
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
              isCorrect ? "text-[#4CAF50]" : "text-[#99A0AE]"
            }`}
          >
            {isCorrect ? "Correct! You're a natural." : "Not quite — but you get the idea!"}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN OVERLAY
// ============================================
export function OnboardingOverlay({
  onComplete,
  errorMessage = null,
  demoQuestion,
}: OnboardingOverlayProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const slides = buildSlides(!!demoQuestion);
  const currentSlide = slides[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slides.length - 1;
  const isDemoSlide = currentSlide.type === "demo";

  const goToNextSlide = useCallback(() => {
    setDirection(1);
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  }, [currentSlideIndex]);

  const handleNext = async () => {
    setDirection(1);
    if (!isLastSlide) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      setIsLoading(true);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#FFC931", "#8B5CF6", "#3B82F6"],
        });
        await onComplete();
      } catch (error) {
        console.error("Onboarding failed:", error);
        setIsLoading(false);
      }
    }
  };

  // Smooth slide variants
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

  return (
    <motion.div
      className="inset-0 z-81 flex flex-col pt-8 app-background fixed!"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <FloatingParticles />

      {/* Logo */}
      <motion.div
        className="flex shrink-0 items-center justify-center p-2 z-10"
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      >
        <h1 id="onboarding-title" className="sr-only">
          Onboarding
        </h1>
        <div className="relative w-[123px] h-[24px]">
          <Image
            src="/logo-onboarding.png"
            alt="Waffles Logo"
            fill
            sizes="123px"
            priority
            className="object-contain"
          />
        </div>
      </motion.div>

      {/* Slides */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden z-10">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentSlideIndex}
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
            {isDemoSlide && demoQuestion ? (
              <div className="flex flex-col items-center w-full gap-4">
                <DemoQuestionSlide
                  question={demoQuestion}
                  onComplete={goToNextSlide}
                />
                <ProgressDots
                  total={slides.length}
                  current={currentSlideIndex}
                />
              </div>
            ) : currentSlide.type === "info" ? (
              <div className="flex flex-col items-center gap-8 text-center w-full">
                {/* Illustration with gentle float */}
                <motion.div
                  className="relative w-[262px] h-[177px]"
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <Image
                    src={currentSlide.data.icon}
                    alt={currentSlide.data.title}
                    fill
                    className="object-contain drop-shadow-lg"
                    priority
                  />
                </motion.div>

                {/* Content */}
                <div className="flex flex-col items-center w-full px-4 gap-5">
                  <div className="flex flex-col items-center gap-1">
                    <h2 className="text-[44px] text-white font-normal text-center leading-[0.92] tracking-[-0.03em] font-body">
                      {currentSlide.data.title}
                    </h2>
                    <p className="text-[16px] font-medium font-display text-[#99A0AE] text-center leading-[130%] tracking-[-0.03em] max-w-md text-pretty">
                      {currentSlide.data.description}
                    </p>
                  </div>

                  <ProgressDots
                    total={slides.length}
                    current={currentSlideIndex}
                  />

                  {/* Button */}
                  <WaffleButton
                    onClick={handleNext}
                    disabled={isLoading}
                    className="text-[26px] text-[#1E1E1E] w-full max-w-full"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 0.7,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        />
                        Loading...
                      </span>
                    ) : isLastSlide ? (
                      "Let's Go"
                    ) : (
                      "Next"
                    )}
                  </WaffleButton>
                  {errorMessage ? (
                    <p className="max-w-sm text-center text-sm text-red-300">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
