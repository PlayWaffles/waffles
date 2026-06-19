"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QuestionCardHeader } from "@/components/quiz/QuestionCardHeader";
import { QuestionOption } from "@/components/quiz/QuestionOption";
import { PixelButton } from "@/components/ui/PixelButton";
import {
  getSpeedTier,
  getAnswerFeedback,
  getTimeoutFeedback,
  resetFeedbackMessages,
  type AnswerResult,
} from "@/lib/game/tension";
import type { FormatDef, VQuestion } from "../data";
import { Illustration } from "./Illustration";

type Phase = "playing" | "revealed" | "done";

/**
 * Generic runner for the "choice" and "set" engines. It mirrors the live
 * QuestionView (timer header, speed-tiered options, roast feedback, streak)
 * but is self-contained — no realtime provider — so it works in the sample.
 */
export function FormatRunner({
  format,
  onExit,
}: {
  format: FormatDef;
  onExit: () => void;
}) {
  const questions = format.questions ?? [];
  const total = questions.length;

  const [qIdx, setQIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [remaining, setRemaining] = useState(questions[0]?.durationSec ?? 10);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [streak, setStreak] = useState(0);
  const [streakBroken, setStreakBroken] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const startedAt = useRef<number>(0);

  const q: VQuestion | undefined = questions[qIdx];

  // Reset roast-message pool + start the clock once per playthrough.
  useEffect(() => {
    resetFeedbackMessages();
    startedAt.current = Date.now();
  }, [format.id]);

  // Responsive option width (multiple of 4, like the live game).
  const [buttonWidth, setButtonWidth] = useState(296);
  useEffect(() => {
    const measure = () =>
      setButtonWidth(Math.floor((Math.min(window.innerWidth, 576) - 32) / 4) * 4);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const reveal = useCallback(
    (selected: number | null) => {
      if (!q) return;
      const isCorrect = selected !== null && selected === q.correctIndex;
      const timeTakenMs = Date.now() - startedAt.current;

      let feedbackResult: AnswerResult;
      if (selected === null) {
        feedbackResult = {
          isCorrect: false,
          speedTier: "timeout",
          feedback: getTimeoutFeedback(),
          pointsEarned: 0,
        };
      } else {
        const tier = getSpeedTier(timeTakenMs, q.durationSec);
        const points = isCorrect ? Math.round(100 + remaining * 15) : 0;
        feedbackResult = {
          isCorrect,
          speedTier: tier,
          feedback: format.minefield && !isCorrect
            ? { text: "💥 MINE HIT — STREAK WIPED", color: "#FF4444" }
            : getAnswerFeedback(tier, streak, isCorrect),
          pointsEarned: points,
        };
      }

      setSelectedIndex(selected);
      setResult(feedbackResult);
      setPhase("revealed");
      setScore((s) => s + feedbackResult.pointsEarned);
      if (feedbackResult.isCorrect) {
        setCorrectCount((c) => c + 1);
        setStreak((s) => s + 1);
        setStreakBroken(false);
      } else {
        setStreakBroken(streak > 0);
        setStreak(0);
      }
    },
    [q, remaining, streak, format.minefield],
  );

  // Countdown — 1s ticks while a question is live. The reveal-on-timeout fires
  // from inside the timeout callback (not the effect body) to avoid cascading
  // synchronous setState during render/commit.
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setTimeout(() => {
      if (remaining <= 1) {
        setRemaining(0);
        reveal(null);
      } else {
        setRemaining((r) => r - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, remaining, reveal]);

  const advance = () => {
    if (qIdx + 1 >= total) {
      setPhase("done");
      return;
    }
    const next = qIdx + 1;
    setQIdx(next);
    setRemaining(questions[next].durationSec);
    setSelectedIndex(null);
    setResult(null);
    setStreakBroken(false);
    setPhase("playing");
    startedAt.current = Date.now();
  };

  const replay = () => {
    resetFeedbackMessages();
    setQIdx(0);
    setRemaining(questions[0].durationSec);
    setSelectedIndex(null);
    setResult(null);
    setStreak(0);
    setStreakBroken(false);
    setScore(0);
    setCorrectCount(0);
    setPhase("playing");
    startedAt.current = Date.now();
  };

  if (phase === "done") {
    return <Summary total={total} correct={correctCount} score={score} onReplay={replay} onExit={onExit} />;
  }
  if (!q) return null;

  const answered = phase === "revealed";
  const tremor = !answered && remaining <= 4 ? (1 - remaining / 4) * 3 : 0;
  const isLowTime = remaining <= 3 && remaining > 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
      <QuestionCardHeader
        questionNumber={qIdx + 1}
        totalQuestions={total}
        remaining={remaining}
        duration={q.durationSec}
        streak={streak}
        streakBroken={streakBroken}
      />

      <section className="flex w-full flex-1 flex-col" aria-live="polite">
        {q.kicker ? (
          <p
            className="mx-auto mb-2 px-4 text-center font-display text-[12px] font-semibold uppercase tracking-[0.15em]"
            style={{ color: format.minefield ? "#FF6B6B" : "var(--brand-gold)" }}
          >
            {q.kicker}
          </p>
        ) : null}

        {/* Who Am I? — clue reveal */}
        {q.clues ? (
          <ul className="mx-auto mb-3 w-full max-w-[340px] space-y-1.5 px-4">
            {q.clues.map((clue, i) => (
              <motion.li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2 font-display text-[13px] leading-snug text-white/85"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.4, duration: 0.3 }}
              >
                <span className="mt-px font-body text-waffle-gold">{i + 1}.</span>
                {clue}
              </motion.li>
            ))}
          </ul>
        ) : null}

        {q.media ? <Illustration media={q.media} /> : null}

        <motion.div
          className="relative mx-auto mb-4 flex w-full items-center justify-center px-4 text-center font-body font-normal leading-[0.95] tracking-[-0.03em] text-white"
          style={{ fontSize: "clamp(22px, 6.5vw, 32px)" }}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <QuestionContent text={q.content} answer={q.options[q.correctIndex]} answered={answered} />
        </motion.div>

        {q.category ? (
          <p className="mx-auto mb-3 font-display text-[10px] uppercase tracking-[0.2em] text-white/35">
            {q.category}
          </p>
        ) : null}

        <ul className={`flex w-full flex-col gap-3 px-4 ${result ? "pb-28" : ""}`}>
          {q.options.map((opt, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + idx * 0.08 }}
            >
              <RevealableOption
                option={opt}
                index={idx}
                selectedIndex={selectedIndex}
                correctIndex={q.correctIndex}
                answered={answered}
                onSelect={() => phase === "playing" && reveal(idx)}
                tremor={tremor}
                speedTier={result?.speedTier ?? null}
                buttonWidth={buttonWidth}
              />
            </motion.div>
          ))}
        </ul>

        <AnimatePresence>
          {result ? (
            <motion.div
              className="sticky bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 px-4 pb-4 pt-3"
              style={{ background: "linear-gradient(to top, var(--brand-black) 60%, transparent 100%)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <motion.p
                className="text-center font-body text-lg"
                style={{ color: result.feedback.color }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.12, 1], opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                {result.feedback.text}
                {result.isCorrect ? (
                  <span className="ml-2 text-success">+{result.pointsEarned}</span>
                ) : null}
              </motion.p>
              <PixelButton
                variant="filled"
                colorTheme={format.accent}
                width={buttonWidth}
                height={52}
                fontSize={15}
                onClick={advance}
              >
                {qIdx + 1 >= total ? "SEE RESULTS" : "NEXT QUESTION"}
              </PixelButton>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      <span className="sr-only" aria-live="assertive">
        {isLowTime ? `${remaining} seconds left` : ""}
      </span>
    </div>
  );
}

/**
 * Wraps the live QuestionOption but, after answering, overlays the correct /
 * wrong outcome (the live one relies on server reveal we don't have here).
 */
function RevealableOption({
  option,
  index,
  selectedIndex,
  correctIndex,
  answered,
  onSelect,
  tremor,
  speedTier,
  buttonWidth,
}: {
  option: string;
  index: number;
  selectedIndex: number | null;
  correctIndex: number;
  answered: boolean;
  onSelect: (i: number) => void;
  tremor: number;
  speedTier: AnswerResult["speedTier"] | null;
  buttonWidth: number;
}) {
  const isCorrect = index === correctIndex;
  const isPicked = index === selectedIndex;

  if (!answered) {
    return (
      <QuestionOption
        option={option}
        index={index}
        selectedOptionIndex={selectedIndex}
        onSelect={onSelect}
        disabled={false}
        tremor={tremor}
        speedTier={speedTier}
        buttonWidth={buttonWidth}
      />
    );
  }

  // Post-answer state: dim everything, ring the correct answer, mark a wrong pick.
  const ring = isCorrect ? "#14B985" : isPicked ? "#FF4444" : "transparent";
  return (
    <motion.div
      className="mx-auto flex items-center justify-center"
      animate={{ opacity: isCorrect || isPicked ? 1 : 0.4, scale: isCorrect ? 1.04 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      style={{ width: buttonWidth }}
    >
      <div className="relative" style={{ borderRadius: 8, boxShadow: `0 0 0 3px ${ring}` }}>
        {/* Pass only this button's own selection so QuestionOption never runs
            its "fly the other options away" animation — every option stays
            fully visible during the reveal. */}
        <QuestionOption
          option={option}
          index={index}
          selectedOptionIndex={isPicked ? index : null}
          onSelect={() => {}}
          disabled
          speedTier={isPicked ? speedTier : null}
          buttonWidth={buttonWidth}
        />
      </div>
    </motion.div>
  );
}

/**
 * Renders question text. For a missing-word sentence (contains "______") the
 * blank gets its own centered line — empty underline before answering, then
 * the correct word in green once revealed.
 */
function QuestionContent({
  text,
  answer,
  answered,
}: {
  text: string;
  answer: string;
  answered: boolean;
}) {
  if (!text.includes("______")) return <>{text}</>;
  const [before, after] = text.split("______");
  return (
    <span className="flex flex-col items-center gap-2">
      <span>{before.trim()}</span>
      <span
        className="inline-flex min-w-[150px] items-center justify-center border-b-[5px] px-4 pb-1.5 leading-none transition-colors"
        style={{
          borderColor: answered ? "#14B985" : "var(--brand-gold)",
          color: answered ? "#14B985" : "#fff",
        }}
      >
        {answered ? answer : " "}
      </span>
      <span>{after.trim()}</span>
    </span>
  );
}

function Summary({
  total,
  correct,
  score,
  onReplay,
  onExit,
}: {
  total: number;
  correct: number;
  score: number;
  onReplay: () => void;
  onExit: () => void;
}) {
  return (
    <motion.div
      className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-6 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-5xl">{correct === total ? "🏆" : correct > 0 ? "⚽" : "🧤"}</div>
      <div>
        <p className="font-body text-[28px] leading-none text-white">{score} pts</p>
        <p className="mt-2 font-display text-[13px] uppercase tracking-wider text-white/55">
          {correct} / {total} correct
        </p>
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <PixelButton variant="filled" colorTheme="gold" width={240} height={52} fontSize={15} onClick={onReplay}>
          PLAY AGAIN
        </PixelButton>
        <PixelButton variant="outline" colorTheme="cyan" width={240} height={48} fontSize={14} onClick={onExit}>
          BACK TO FORMATS
        </PixelButton>
      </div>
    </motion.div>
  );
}
