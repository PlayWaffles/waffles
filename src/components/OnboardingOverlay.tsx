"use client";

import React, { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import confetti from "canvas-confetti";

interface OnboardingOverlayProps {
  onComplete: () => void;
  errorMessage?: string | null;
}

interface Slide {
  icon: string;
  title: string;
  description: React.ReactNode;
}

const slides: Slide[] = [
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
// MAIN OVERLAY
// ============================================
export function OnboardingOverlay({
  onComplete,
  errorMessage = null,
}: OnboardingOverlayProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const currentSlide = slides[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slides.length - 1;

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
                  src={currentSlide.icon}
                  alt={currentSlide.title}
                  fill
                  className="object-contain drop-shadow-lg"
                  priority
                />
              </motion.div>

              {/* Content */}
              <div className="flex flex-col items-center w-full px-4 gap-5">
                <div className="flex flex-col items-center gap-1">
                  <h2 className="text-[44px] text-white font-normal text-center leading-[0.92] tracking-[-0.03em] font-body">
                    {currentSlide.title}
                  </h2>
                  <p className="text-[16px] font-medium font-display text-[#99A0AE] text-center leading-[130%] tracking-[-0.03em] max-w-md text-pretty">
                    {currentSlide.description}
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
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
