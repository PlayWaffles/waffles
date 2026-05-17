"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { WaffleButton } from "@/components/buttons/WaffleButton";
import { PixelButton } from "@/components/ui/PixelButton";
import type { DemoQuestion } from "@/actions/onboarding";

interface OnboardingOverlayProps {
  onComplete: () => void;
  errorMessage?: string | null;
  demoQuestion?: DemoQuestion | null;
}

const optionColorThemes = ["gold", "purple", "cyan", "green"] as const;

function PitchSlide({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center w-full px-6 gap-8 animate-[onboarding-enter_360ms_ease-out]">
      <div className="relative w-[220px] h-[150px]">
        <Image
          src="/images/illustrations/movie-clapper.webp"
          alt="Movie scene"
          fill
          className="object-contain"
          priority
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <h2
          className="font-body text-white text-center leading-[0.92] tracking-[-0.03em]"
          style={{ fontSize: "clamp(36px, 10vw, 48px)" }}
        >
          GUESS THE SCENE.
          <br />
          <span className="text-waffle-gold">WIN THE POT.</span>
        </h2>
        <p className="font-display text-[15px] leading-[1.4] text-white/50 text-center max-w-[280px]">
          AI-remixed movie scenes. Live arena. Top scorers split the prize pool.
        </p>
      </div>

      <div className="flex items-center gap-6">
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
      </div>

      <div className="w-full">
        <WaffleButton onClick={onNext} className="w-full max-w-full">
          TRY A QUESTION
        </WaffleButton>
      </div>
    </div>
  );
}

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
        import("canvas-confetti")
          .then(({ default: confetti }) => {
            confetti({
              particleCount: 60,
              spread: 50,
              origin: { y: 0.5 },
              colors: ["#FFC931", "#14B985", "#1B8FF5"],
            });
          })
          .catch(() => {});
      }

      setShowResult(true);
      window.setTimeout(() => onComplete(isCorrect), isCorrect ? 1200 : 1500);
    },
    [selectedIndex, onComplete, question.correctIndex],
  );

  const isCorrect = selectedIndex !== null && selectedIndex === question.correctIndex;

  return (
    <div className="flex flex-col items-center gap-4 text-center w-full px-4 animate-[onboarding-enter_300ms_ease-out]">
      <span className="font-display text-[11px] uppercase tracking-[0.18em] text-white/35">
        Try it - guess the movie
      </span>

      <h2
        className="font-body text-white text-center leading-[0.92] tracking-[-0.03em]"
        style={{ fontSize: "clamp(24px, 7vw, 30px)" }}
      >
        {question.content}
      </h2>

      {question.mediaUrl && (
        <div className="relative w-full max-w-[280px] aspect-video rounded-[10px] overflow-hidden bg-card border border-border shadow-[0_8px_0_#000]">
          <Image
            src={question.mediaUrl}
            alt="Guess this movie scene"
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      <ul className="flex w-full flex-col gap-3 items-center">
        {question.options.map((option, idx) => {
          const hasSelection = selectedIndex !== null;
          const isSelected = selectedIndex === idx;
          const isCorrectOption = idx === question.correctIndex;
          const shouldHighlight = hasSelection && (isSelected || isCorrectOption);

          return (
            <li
              key={idx}
              className={[
                "flex justify-center transition-[opacity,transform] duration-200",
                hasSelection && !isSelected && !isCorrectOption ? "opacity-30" : "opacity-100",
                shouldHighlight ? "scale-[1.08]" : "scale-100",
              ].join(" ")}
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
            </li>
          );
        })}
      </ul>

      {showResult && (
        <div
          className={`text-[18px] font-display font-medium animate-[onboarding-enter_180ms_ease-out] ${
            isCorrect ? "text-success" : "text-muted"
          }`}
        >
          {isCorrect ? "You're a natural." : "Not quite - but you get the idea."}
        </div>
      )}
    </div>
  );
}

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
    <div className="flex flex-col items-center w-full px-6 gap-6 animate-[onboarding-enter_300ms_ease-out]">
      <div className="relative w-[200px] h-[140px]">
        <Image
          src="/images/illustrations/treasure-chest.webp"
          alt="Prize pool"
          fill
          className="object-contain"
          priority
        />
      </div>

      <div className="flex flex-col items-center gap-3">
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
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[300px]">
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
      </div>

      <div className="w-full mt-2">
        <WaffleButton onClick={onComplete} disabled={isLoading} className="w-full max-w-full">
          {isLoading ? (
            <span className="flex items-center justify-center gap-2" role="status" aria-label="Loading">
              <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
      </div>
    </div>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {[...Array(total)].map((_, i) => (
        <div
          key={i}
          className={[
            "h-1.5 rounded-full transition-[width,background-color,opacity] duration-200",
            i === current ? "w-6" : "w-2",
            i <= current ? "opacity-100 bg-[var(--brand-gold)]" : "opacity-50 bg-white/20",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export function OnboardingOverlay({
  onComplete,
  errorMessage = null,
  demoQuestion,
}: OnboardingOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [demoWasCorrect, setDemoWasCorrect] = useState(false);

  const totalSlides = demoQuestion ? 3 : 2;

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
  }, [totalSlides]);

  const handleDemoComplete = useCallback((wasCorrect: boolean) => {
    setDemoWasCorrect(wasCorrect);
    setCurrentSlide((prev) => prev + 1);
  }, []);

  const handleFinish = async () => {
    setIsLoading(true);
    try {
      const { default: confetti } = await import("canvas-confetti");
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

  const renderSlide = () => {
    if (currentSlide === 0) return <PitchSlide onNext={goNext} />;
    if (demoQuestion && currentSlide === 1) {
      return <DemoQuestionSlide question={demoQuestion} onComplete={handleDemoComplete} />;
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
    <div
      className="inset-0 z-81 flex flex-col app-background fixed! animate-[onboarding-fade_240ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <h1 id="onboarding-title" className="sr-only">Welcome to Waffles</h1>

      <div className="flex items-center justify-between px-5 pt-4 pb-2 z-10 shrink-0">
        <div className="relative w-[100px] h-[20px]">
          <Image
            src="/logo-onboarding.webp"
            alt="Waffles"
            fill
            sizes="100px"
            priority
            className="object-contain"
          />
        </div>
        <ProgressDots total={totalSlides} current={currentSlide} />
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden z-10">
        <div key={currentSlide} className="absolute inset-0 flex items-center justify-center">
          {renderSlide()}
        </div>
      </div>
    </div>
  );
}
