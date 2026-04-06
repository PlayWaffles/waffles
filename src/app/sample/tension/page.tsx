"use client";

/**
 * Sample page: Question Tension Redesign
 *
 * Demonstrates the emotional redesign of the question/answer experience.
 * Visit /sample/tension to preview.
 *
 * Key changes from current design:
 * 1. Point-of-no-return stamp on answer selection (lateral slide-away)
 * 2. Progressive timer pressure (vignette, tremor, acceleration)
 * 3. Live PFP avatars beside question as players answer (social pressure)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PixelButton } from "@/components/ui/PixelButton";
import { playSound } from "@/lib/sounds";

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

interface SampleQuestion {
  id: string;
  content: string;
  options: string[];
  correctIndex: number;
  durationSec: number;
  mediaUrl: string | null;
  theme: string;
}

const TOTAL_PLAYERS = 32;

// Mock player profiles for the answerer feed
const MOCK_PLAYERS = [
  { username: "vitalik.eth", pfp: "https://i.pravatar.cc/80?u=vitalik" },
  { username: "alice", pfp: "https://i.pravatar.cc/80?u=alice" },
  { username: "0xbob", pfp: "https://i.pravatar.cc/80?u=0xbob" },
  { username: "trivia_queen", pfp: "https://i.pravatar.cc/80?u=queen" },
  { username: "degen.fc", pfp: "https://i.pravatar.cc/80?u=degen" },
  { username: "chad", pfp: "https://i.pravatar.cc/80?u=chad" },
  { username: "ser_punts", pfp: "https://i.pravatar.cc/80?u=punts" },
  { username: "moonboy", pfp: "https://i.pravatar.cc/80?u=moon" },
  { username: "0xjane", pfp: "https://i.pravatar.cc/80?u=jane" },
  { username: "quizmaster", pfp: "https://i.pravatar.cc/80?u=quiz" },
  { username: "anon_42", pfp: "https://i.pravatar.cc/80?u=anon42" },
  { username: "wagmi.eth", pfp: "https://i.pravatar.cc/80?u=wagmi" },
  { username: "speedrun", pfp: "https://i.pravatar.cc/80?u=speed" },
  { username: "big_brain", pfp: "https://i.pravatar.cc/80?u=brain" },
  { username: "0xcarl", pfp: "https://i.pravatar.cc/80?u=carl" },
  { username: "farcaster_og", pfp: "https://i.pravatar.cc/80?u=farcasterog" },
];

// =============================================================================
// COLOR THEMES (matching app)
// =============================================================================

// Dynamic feedback messages based on speed and streak
const answerFeedback = {
  fast_correct: [
    "LIGHTNING FAST",
    "SPEED DEMON",
    "NO HESITATION",
    "CALM DOWN GENIUS",
    "OK SHOWOFF",
    "BUILT DIFFERENT",
    "TOO EASY FOR YOU HUH",
    "SCARY GOOD",
  ],
  fast_wrong: [
    "FAST AND WRONG LMAO",
    "SPEEDRUNNING FAILURE",
    "YOU DIDN'T EVEN READ IT",
    "CONFIDENCE OF A CEO, IQ OF A GOLDFISH",
    "QUICK TO EMBARRASS YOURSELF",
    "ALL SPEED NO BRAIN",
    "FASTEST L I'VE EVER SEEN",
    "AT LEAST YOU'RE FAST AT BEING WRONG",
  ],
  mid_correct: [
    "SOLID I GUESS",
    "NOT BAD",
    "STEADY HANDS",
    "GOT THERE EVENTUALLY",
    "TOOK YOUR TIME BUT OK",
    "CALCULATED",
    "YOU THOUGHT ABOUT IT AND IT WORKED",
    "RESPECTABLE",
  ],
  mid_wrong: [
    "ALL THAT THINKING FOR NOTHING",
    "MID EFFORT MID RESULTS",
    "YOUR WIFI LAGGING OR YOUR BRAIN?",
    "AVERAGE ANSWER FROM AN AVERAGE PLAYER",
    "ROOM TEMPERATURE IQ SPEED",
    "YOU THOUGHT ABOUT IT AND STILL MISSED",
    "OVERTHINKING IS YOUR SPORT",
    "THE AUDACITY TO BE SLOW AND WRONG",
  ],
  slow_correct: [
    "JUST IN TIME",
    "CUTTING IT CLOSE",
    "BARELY MADE IT BUT YOU MADE IT",
    "PHEW",
    "THE DRAMA WAS UNNECESSARY BUT OK",
    "CLUTCH",
    "SWEAT WAS DRIPPING",
    "YOU LOVE THE PRESSURE HUH",
  ],
  slow_wrong: [
    "GRANDMA TYPES FASTER",
    "WERE YOU ASLEEP?",
    "ALL THAT TIME AND STILL WRONG",
    "THE TIMER WAS BEGGING YOU",
    "THAT WAS PAINFUL TO WATCH",
    "DID YOU GOOGLE IT AND STILL GET IT WRONG?",
    "SLOWPOKE AND WRONG",
    "EVEN THE BOTS BEAT YOU",
  ],
  streak: [
    "OK RELAX",
    "UNSTOPPABLE FR",
    "SOMEONE'S BEEN STUDYING",
    "SAVE SOME WINS FOR THE REST OF US",
    "ARE YOU CHEATING?",
    "DISGUSTING STREAK",
    "MAIN CHARACTER ENERGY",
    "YOU'RE COOKED... IN A GOOD WAY",
  ],
  timeout: [
    "HELLO? ANYONE HOME?",
    "YOU JUST STOOD THERE",
    "FREE POINTS AND YOU STILL MISSED",
    "THE SCREEN WAS RIGHT THERE",
    "DID YOU FALL ASLEEP?",
    "EVEN A RANDOM TAP WOULD'VE BEEN BETTER",
    "YOUR PHONE DIED OR YOUR BRAIN?",
    "AFK DIFF",
    "LITERALLY JUST TAP SOMETHING",
    "YOU LET THE CLOCK WIN",
  ],
} as const;

const usedMessages = new Set<string>();

function pickUnique(pool: readonly string[]): string {
  const available = pool.filter((m) => !usedMessages.has(m));
  const pick = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : pool[Math.floor(Math.random() * pool.length)];
  usedMessages.add(pick);
  return pick;
}

function getAnswerMessage(speed: SpeedTier, streak: number, correct: boolean): { text: string; color: string } {
  if (streak >= 3 && correct) {
    return { text: pickUnique(answerFeedback.streak), color: "#FF4444" };
  }
  if (speed === "fast") {
    return correct
      ? { text: pickUnique(answerFeedback.fast_correct), color: "#14B985" }
      : { text: pickUnique(answerFeedback.fast_wrong), color: "#FF6B6B" };
  }
  if (speed === "mid") {
    return correct
      ? { text: pickUnique(answerFeedback.mid_correct), color: "#FFC931" }
      : { text: pickUnique(answerFeedback.mid_wrong), color: "#FF6B6B" };
  }
  if (speed === "slow") {
    return correct
      ? { text: pickUnique(answerFeedback.slow_correct), color: "#14B985" }
      : { text: pickUnique(answerFeedback.slow_wrong), color: "#FF6B6B" };
  }
  return { text: pickUnique(answerFeedback.timeout), color: "#FF4444" };
}

function getTimeoutMessage(): { text: string; color: string } {
  return { text: pickUnique(answerFeedback.timeout), color: "#FF4444" };
}

const optionColors = [
  { name: "gold", theme: "gold" as const, accent: "#FFC931" },
  { name: "purple", theme: "purple" as const, accent: "#B01BF5" },
  { name: "cyan", theme: "cyan" as const, accent: "#1B8FF5" },
  { name: "green", theme: "green" as const, accent: "#4CAF50" },
];

// =============================================================================
// TENSION OPTION COMPONENT
// =============================================================================

const speedFeedback = {
  fast: { label: "FAST", color: "#14B985" },
  mid: { label: "OK", color: "#FFC931" },
  slow: { label: "SLOW", color: "#FF6B6B" },
  timeout: { label: "MISSED", color: "#FF4444" },
} as const;

type SpeedTier = keyof typeof speedFeedback | null;

function TensionOption({
  option,
  index,
  selectedIndex,
  onSelect,
  disabled,
  tremor,
  speed,
  buttonWidth,
}: {
  option: string;
  index: number;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  disabled: boolean;
  tremor: number;
  speed: SpeedTier;
  buttonWidth: number;
}) {
  const [isStamping, setIsStamping] = useState(false);

  const isSelected = selectedIndex === index;
  const hasSelection = selectedIndex !== null;
  const color = optionColors[index % optionColors.length];
  const fb = speed ? speedFeedback[speed] : null;

  const handleTap = () => {
    if (disabled || hasSelection) return;
    setIsStamping(true);
    playSound("answerSubmit");
    setTimeout(() => {
      onSelect(index);
    }, 100);
  };

  const getExitX = () => {
    if (!hasSelection || isSelected) return 0;
    return index < selectedIndex! ? -120 : 120;
  };

  const tremorX = tremor > 0 && !hasSelection ? (Math.random() - 0.5) * tremor * 2 : 0;
  const tremorY = tremor > 0 && !hasSelection ? (Math.random() - 0.5) * tremor * 1.5 : 0;

  return (
    <motion.li
      className="mx-auto flex justify-center relative"
      style={{ zIndex: isSelected ? 10 : 1 }}
      animate={{
        opacity: hasSelection && !isSelected ? 0 : 1,
        x: hasSelection && !isSelected ? getExitX() : tremorX,
        y: tremorY,
        scale: isStamping ? 0.93 : isSelected ? 1.08 : 1,
      }}
      transition={
        hasSelection && !isSelected
          ? {
              opacity: { duration: 0.25, delay: Math.abs(index - selectedIndex!) * 0.05 },
              x: { type: "spring", stiffness: 300, damping: 20, delay: Math.abs(index - selectedIndex!) * 0.04 },
            }
          : isSelected
            ? { scale: { type: "spring", stiffness: 600, damping: 15 } }
            : { x: { duration: 0 }, y: { duration: 0 }, scale: { type: "spring", stiffness: 400, damping: 25 } }
      }
    >
      {/* Speed tag on the selected button */}
      <AnimatePresence>
        {isSelected && fb && (
          <motion.span
            className="absolute -top-2 -right-2 z-20 px-2 py-0.5 rounded-full font-display text-[9px] font-bold tracking-wider"
            style={{
              backgroundColor: fb.color,
              color: "#1E1E1E",
              boxShadow: `0 0 12px ${fb.color}80`,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.3 }}
          >
            {fb.label}
          </motion.span>
        )}
      </AnimatePresence>

      <PixelButton
        aria-pressed={isSelected}
        tabIndex={-1}
        variant="filled"
        colorTheme={color.theme}
        width={buttonWidth}
        height={53}
        fontSize={15}
        onClick={handleTap}
        disabled={disabled}
      >
        {option}
      </PixelButton>
    </motion.li>
  );
}


// =============================================================================
// TENSION TIMER TUBE
// =============================================================================

function TensionTimerTube({
  remaining,
  duration,
}: {
  remaining: number;
  duration: number;
}) {
  // Progress accelerates as time runs low
  const rawProgress = duration > 0 ? (duration - remaining) / duration : 1;
  // Apply easeIn curve to make it feel like it's accelerating
  const easedProgress =
    remaining <= 5
      ? rawProgress + (1 - rawProgress) * Math.pow(1 - remaining / 5, 2) * 0.15
      : rawProgress;
  const clipWidth = 78 * (1 - Math.min(1, easedProgress));

  const isLowTime = remaining <= 3;
  const isMedTime = remaining <= 5 && remaining > 3;
  const isTimeUp = remaining === 0;

  // Color shifts: orange → red → deep red
  const fillColor = isTimeUp
    ? "#8B1A1A"
    : isLowTime
      ? "#CC2222"
      : isMedTime
        ? "#E85535"
        : "#F96F49";

  return (
    <motion.svg
      width="78"
      height="12"
      viewBox="0 0 78 12"
      fill="none"
      animate={
        isTimeUp
          ? { scale: 1, x: 0, opacity: 0.4, rotate: 0 }
          : isLowTime
            ? {
                scale: [1, 1.12, 1, 1.08, 1],
                x: [-1.5, 1.5, -1, 1, 0],
                rotate: [-1.5, 1.5, -1, 1, 0],
              }
            : isMedTime
              ? {
                  scale: [1, 1.04, 1],
                }
              : { scale: 1, x: 0, rotate: 0 }
      }
      transition={
        isLowTime
          ? { duration: 0.35, repeat: Infinity, ease: "easeInOut" }
          : isMedTime
            ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
      }
    >
      {/* Background (unfilled) */}
      <rect x="0" y="0" width="78" height="12" rx="6" ry="6" fill="#E9DCCB" />

      {/* Fill (animated clip) */}
      <g>
        <clipPath id="tension-timer-clip">
          <motion.rect
            x="0"
            y="0"
            height="12"
            animate={{ width: clipWidth }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </clipPath>
        <g clipPath="url(#tension-timer-clip)">
          <rect
            x="0"
            y="0"
            width="78"
            height="12"
            rx="6"
            ry="6"
            fill={fillColor}
          />
          {/* Highlight */}
          <rect
            x="3"
            y="2"
            width="72"
            height="5"
            rx="2.5"
            fill="white"
            opacity="0.2"
          />
        </g>
      </g>
    </motion.svg>
  );
}

// =============================================================================
// ANSWERER AVATARS (compact PFP row beside the question)
// =============================================================================

type AnswererEntry = { username: string; pfp: string; id: number; correct: boolean };

function AnswererAvatars({
  answerers,
  hasAnswered,
}: {
  answerers: AnswererEntry[];
  hasAnswered: boolean;
}) {
  const visible = answerers.slice(-5);
  const overflow = answerers.length - visible.length;

  return (
    <motion.div
      className="relative mx-4 overflow-hidden"
      style={{ minHeight: 65 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* PFP row */}
      <div className="flex gap-1.5 justify-center flex-nowrap pr-4">
        <AnimatePresence>
          {answerers.slice(-6).map((player) => (
            <motion.div
              key={player.id}
              className="relative overflow-visible"
              style={{ width: 50, height: 50, flexShrink: 0 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              title={player.username}
            >
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: `2px solid ${player.correct ? "#14B985" : "#FF4444"}` }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />

              {/* PFP */}
              <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-[#F5BB1B] to-[#FF6B35]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={player.pfp}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>

              {/* Result badge inside PFP */}
              <motion.div
                className="absolute rounded-full flex items-center justify-center"
                style={{
                  width: 14,
                  height: 14,
                  bottom: -1,
                  right: -1,
                  backgroundColor: player.correct ? "#14B985" : "#FF4444",
                  boxShadow: "0 0 0 2px #1e1e1e",
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
            </motion.div>
          ))}
        </AnimatePresence>

        {/* +N overflow circle */}
        {overflow > 0 && (
          <motion.div
            key={`overflow-${overflow}`}
            className="rounded-full flex items-center justify-center font-body"
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
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// STREAK FIRE
// =============================================================================

function StreakFire({ streak }: { streak: number }) {
  if (streak < 2) return null;

  return (
    <motion.div
      className="flex items-center gap-1"
      initial={{ scale: 0, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 600, damping: 12 }}
      key={streak}
    >
      <motion.span
        className="text-lg"
        animate={{ scale: [1, 1.3, 1], rotate: [0, -8, 8, 0] }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        🔥
      </motion.span>
      <motion.span
        className="font-body text-[18px]"
        style={{
          color: streak >= 5 ? "#FF4444" : streak >= 3 ? "#FFC931" : "#FF8844",
          textShadow: `0 0 ${streak * 4}px ${streak >= 5 ? "#FF444480" : streak >= 3 ? "#FFC93180" : "#FF884480"}`,
        }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        x{streak}
      </motion.span>
    </motion.div>
  );
}

// =============================================================================
// STREAK BREAK (shatter animation when streak ends)
// =============================================================================

function StreakBreak({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <motion.div
      className="flex items-center gap-1"
      initial={{ scale: 1, opacity: 1 }}
      animate={{ scale: 0.3, opacity: 0, y: 30, rotate: 25 }}
      transition={{ duration: 0.5, ease: "easeIn" }}
    >
      <span className="text-lg">🔥</span>
      <span className="font-body text-[18px] text-[#FF4444]">x0</span>
    </motion.div>
  );
}

// =============================================================================
// VIGNETTE OVERLAY (progressive edge darkening)
// =============================================================================

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

// =============================================================================
// MAIN SAMPLE PAGE
// =============================================================================

export default function TensionSamplePage() {
  const [questions, setQuestions] = useState<SampleQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [seconds, setSeconds] = useState(10);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answerers, setAnswerers] = useState<AnswererEntry[]>([]);
  const [showDistribution, setShowDistribution] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [speedTier, setSpeedTier] = useState<SpeedTier>(null);
  const [streak, setStreak] = useState(0);
  const [streakBroken, setStreakBroken] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [answerMsg, setAnswerMsg] = useState<{ text: string; color: string } | null>(null);

  const question = questions[questionIndex] ?? null;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerIndexRef = useRef(0);
  const optionsRef = useRef<HTMLUListElement>(null);
  const [buttonWidth, setButtonWidth] = useState(340);

  // Compute button width from screen width minus padding (px-4 = 16px each side)
  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      // Subtract padding (32px) and round down to nearest 4
      setButtonWidth(Math.floor((Math.min(w, 576) - 32) / 4) * 4);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Fetch questions from DB
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/v1/internal/sample-questions?count=5");
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      const formatted: SampleQuestion[] = data.map(
        (q: SampleQuestion) => ({
          ...q,
          content: q.content.toUpperCase(),
        })
      );
      setQuestions(formatted);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pressure intensity: 0 at >5s, ramps to 1 at 0s
  const pressure = seconds <= 5 ? 1 - seconds / 5 : 0;
  // Tremor: 0 until 4s, ramps to 3px at 0s
  const tremor = seconds <= 4 ? (1 - seconds / 4) * 3 : 0;

  const startQuestion = useCallback(
    (qIdx: number, qs: SampleQuestion[] = questions) => {
      const q = qs[qIdx];
      if (!q) return;
      setQuestionIndex(qIdx);
      setSeconds(q.durationSec);
      setSelectedIndex(null);
      setAnswerers([]);
      setShowDistribution(false);
      setSpeedTier(null);
      setStreakBroken(false);
      setAnswerMsg(null);
      playerIndexRef.current = 0;
    },
    [questions]
  );

  // Timer countdown
  useEffect(() => {
    if (!gameStarted) return;
    if (seconds <= 0) return;
    if (selectedIndex !== null) return; // stop timer when answered

    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          playSound("timeUp");
          // Screen shake + streak break + roast on timeout
          setScreenShake(true);
          setAnswerMsg(getTimeoutMessage());
          setTimeout(() => setScreenShake(false), 500);
          setStreak((prev) => {
            if (prev >= 2) setStreakBroken(true);
            return 0;
          });
          return 0;
        }
        if (s === 4) playSound("timerFinal");
        return s - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStarted, seconds <= 0, selectedIndex !== null]);

  // Simulate other players answering (one at a time with PFPs)
  useEffect(() => {
    if (!gameStarted) return;

    setAnswerers([]);
    playerIndexRef.current = 0;

    const addPlayer = () => {
      const idx = playerIndexRef.current;
      if (idx >= MOCK_PLAYERS.length) return;

      const player = MOCK_PLAYERS[idx];
      setAnswerers((prev) => [
        ...prev,
        { ...player, id: Date.now() + idx, correct: Math.random() > 0.4 },
      ]);
      playSound("click");
      playerIndexRef.current = idx + 1;

      // Schedule next player with random delay (faster as time goes on)
      const delay = 800 + Math.random() * 1200;
      botTimerRef.current = setTimeout(addPlayer, delay);
    };

    // First player answers after 1-2s
    botTimerRef.current = setTimeout(addPlayer, 1000 + Math.random() * 1000);

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
  }, [gameStarted, questionIndex]);

  // Handle answer selection
  const handleAnswer = (index: number) => {
    setSelectedIndex(index);
    if (timerRef.current) clearInterval(timerRef.current);

    // Compute speed tier based on remaining time
    if (!question) return;
    const ratio = seconds / question.durationSec;
    const tier = ratio > 0.6 ? "fast" : ratio > 0.3 ? "mid" : seconds > 0 ? "slow" : "timeout";
    const correct = question.correctIndex === index;
    setSpeedTier(tier);

    if (correct) {
      setStreakBroken(false);
      setStreak((s) => s + 1);
      setAnswerMsg(getAnswerMessage(tier, streak + 1, true));
    } else {
      if (streak >= 2) setStreakBroken(true);
      setStreak(0);
      setAnswerMsg(getAnswerMessage(tier, 0, false));
    }

    // Show next button after a beat
    setTimeout(() => {
      setShowDistribution(true);
    }, 600);
  };

  // Advance to next question
  const handleNext = () => {
    const nextIdx = (questionIndex + 1) % questions.length;
    startQuestion(nextIdx);
  };

  // Start game
  const handleStart = async () => {
    await fetchQuestions();
  };

  // After questions load, start the game
  useEffect(() => {
    if (questions.length > 0 && !gameStarted) {
      setGameStarted(true);
      startQuestion(0, questions);
    }
  }, [questions, gameStarted, startQuestion]);

  // Reset
  const handleReset = () => {
    setGameStarted(false);
    setQuestions([]);
    setQuestionIndex(0);
    setSeconds(10);
    setSelectedIndex(null);
    setAnswerers([]);
    setShowDistribution(false);
    setSpeedTier(null);
    setStreak(0);
    setStreakBroken(false);
    setScreenShake(false);
    setAnswerMsg(null);
    usedMessages.clear();
    playerIndexRef.current = 0;
  };

  const isLowTime = seconds <= 3 && seconds > 0;
  const isMedTime = seconds <= 5 && seconds > 3;

  return (
    <div className="app-background h-dvh flex flex-col items-center relative overflow-hidden">
      {/* Pressure vignette */}
      <PressureVignette intensity={pressure} />

      {/* Waffles header — matches live game */}
      {gameStarted && (
        <header className="sticky top-0 left-0 shrink-0 z-40 flex items-center justify-between w-full max-w-xl h-[52px] bg-[#191919] border-b border-b-[#FFFFFF12] px-4 py-3">
          <div className="flex items-center gap-2">
            {/* Logo */}
            <motion.div
              whileHover={{ rotate: [0, -5, 5, -3, 3, 0] }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeInOut" as const }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Waffles"
                className="w-[30px] h-[24px] object-contain"
              />
            </motion.div>

            {/* Live indicator */}
            <motion.span
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <motion.span
                className="w-2 h-2 rounded-full bg-[#FC1919]"
                animate={{
                  scale: [1, 1.3, 1],
                  boxShadow: [
                    "0 0 6px rgba(252, 25, 25, 0.8), 0 0 12px rgba(252, 25, 25, 0.4)",
                    "0 0 10px rgba(252, 25, 25, 1), 0 0 20px rgba(252, 25, 25, 0.6)",
                    "0 0 6px rgba(252, 25, 25, 0.8), 0 0 12px rgba(252, 25, 25, 0.4)",
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" as const }}
              />
              <motion.span
                className="text-[#FC1919] text-[18px] font-body leading-[92%] tracking-[-0.03em]"
                animate={{ opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" as const }}
              >
                Live
              </motion.span>
            </motion.span>
          </div>

          {/* Leave game button */}
          <motion.button
            className="flex items-center bg-white/10 rounded-full px-3 py-1.5 h-[28px] font-body"
            whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.2)", scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="text-[16px] leading-[100%] text-white">
              leave game
            </span>
          </motion.button>
        </header>
      )}

      {/* Start screen */}
      {!gameStarted && (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.button
            className="px-8 py-4 rounded-xl bg-white text-[#1E1E1E] font-body text-2xl border-[5px] border-t-0 border-l-0 border-[#00CFF2] disabled:opacity-50"
            onClick={handleStart}
            disabled={loading}
            whileHover={loading ? undefined : { scale: 1.05, y: -2 }}
            whileTap={loading ? undefined : { scale: 0.97 }}
          >
            {loading ? "LOADING..." : "START DEMO"}
          </motion.button>
          {fetchError && (
            <p className="font-display text-xs text-[#FF6B6B] text-center">
              {fetchError}
            </p>
          )}
          <p className="font-display text-xs text-[#99A0AE] text-center max-w-xs">
            Pulls 5 random questions from the database.
            <br />
            Watch the edges darken and options tremble as time runs low.
          </p>
        </motion.div>
      )}

      {/* Game area */}
      {gameStarted && question && (
        <motion.div
          className="w-full max-w-xl mx-auto flex-1 flex flex-col relative"
          key={question.id}
          initial={{ opacity: 0 }}
          animate={
            screenShake
              ? { opacity: 1, x: [0, -6, 6, -4, 4, -2, 2, 0], y: [0, 3, -3, 2, -2, 1, -1, 0] }
              : { opacity: 1, x: 0, y: 0 }
          }
          transition={screenShake ? { duration: 0.4 } : { duration: 0.3 }}
        >
          {/* Question header with timer */}
          {/* Header — matches real game QuestionCardHeader */}
          <motion.div
            className="w-full flex items-center justify-between px-3 py-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Question counter */}
            <div className="flex items-center gap-2">
              <motion.span
                className="font-body text-white text-[18px] leading-none tracking-tight"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={questionIndex}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="inline-block"
                  >
                    {String(questionIndex + 1).padStart(2, "0")}
                  </motion.span>
                </AnimatePresence>
                /{String(questions.length).padStart(2, "0")}
              </motion.span>

              <AnimatePresence mode="wait">
                {streakBroken ? (
                  <StreakBreak key="break" show />
                ) : (
                  <StreakFire key="fire" streak={streak} />
                )}
              </AnimatePresence>
            </div>

            {/* Timer */}
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              <motion.div
                className="relative overflow-hidden"
                animate={
                  isLowTime ? { scale: [1, 1.1, 1] } : {}
                }
                transition={
                  isLowTime ? { duration: 0.5, repeat: Infinity } : undefined
                }
              >
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={seconds}
                    className="font-body text-[18px] inline-block"
                    style={{
                      color: seconds === 0 ? "#FF6B6B" : isLowTime ? "#FF6B6B" : "#ffffff",
                    }}
                    initial={{ opacity: 0, y: -12, scale: 1.2 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.8 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    {seconds >= 60
                      ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
                      : `0:${String(seconds).padStart(2, "0")}`}
                  </motion.span>
                </AnimatePresence>
              </motion.div>

              <motion.div
                animate={isLowTime ? { scale: [1, 1.05, 1] } : {}}
                transition={isLowTime ? { duration: 0.4, repeat: Infinity } : undefined}
              >
                <TensionTimerTube remaining={seconds} duration={question.durationSec} />
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Question text */}
          <motion.div
            className="relative mx-auto mb-4 flex items-center justify-center w-full font-body font-normal text-[36px] leading-[0.92] text-center tracking-[-0.03em] text-white px-4"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              textShadow: isLowTime
                ? [
                    "0 0 0px rgba(255,68,68,0)",
                    "0 0 25px rgba(255,68,68,0.5)",
                    "0 0 0px rgba(255,68,68,0)",
                  ]
                : "0 0 0px rgba(255,68,68,0)",
            }}
            transition={
              isLowTime
                ? { textShadow: { duration: 0.6, repeat: Infinity } }
                : { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
            }
          >
            {question.content}
          </motion.div>

          {/* Media image */}
          {question.mediaUrl && (
            <motion.figure
              className="mx-auto mb-4 flex justify-center w-full px-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="relative w-full aspect-video rounded-[10px] overflow-hidden bg-[#17171a] border border-[#313136] shadow-[0_8px_0_#000]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={question.mediaUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.figure>
          )}

          {/* Answerer PFPs — right below the question/image */}
          <AnswererAvatars
            answerers={answerers}
            hasAnswered={selectedIndex !== null}
          />

          {/* Options */}
          <motion.ul
            ref={optionsRef}
            className="w-full flex flex-col gap-2 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
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
                <TensionOption
                  option={opt}
                  index={idx}
                  selectedIndex={selectedIndex}
                  onSelect={handleAnswer}
                  disabled={seconds === 0}
                  tremor={tremor}
                  speed={selectedIndex === idx ? speedTier : null}
                  buttonWidth={buttonWidth}
                />
              </motion.div>
            ))}
          </motion.ul>

          {/* Post-answer / Time's up — overlays the options area */}
          <AnimatePresence>
            {(showDistribution || (seconds === 0 && selectedIndex === null)) && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex flex-col items-center gap-2 z-20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <motion.p
                  className="font-body text-lg"
                  style={{ color: answerMsg?.color ?? (selectedIndex !== null ? "#14B985" : "#FF4444") }}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {answerMsg?.text ?? (selectedIndex !== null ? "LOCKED IN" : "TIME'S UP")}
                </motion.p>
                <motion.button
                  className="w-full py-3 rounded-xl bg-white/10 border border-white/20 font-body text-lg text-white"
                  onClick={handleNext}
                  whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.15)" }}
                  whileTap={{ scale: 0.97 }}
                >
                  NEXT QUESTION
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

    </div>
  );
}
