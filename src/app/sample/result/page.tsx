"use client";

/**
 * Sample page: Result Redesign
 *
 * Visit /sample/result to preview.
 *
 * Key features:
 * 1. Personalized roast/hype based on performance
 * 2. Animated score countup with drama
 * 3. Badges earned from gameplay (speed demon, streak master, etc.)
 * 4. Player archetype based on theme strengths (Romance Buff, Horror Expert)
 * 5. Per-question speed breakdown + streak summary
 * 6. Social leaderboard comparison
 * 7. Next game countdown for redemption
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";

// =============================================================================
// TYPES & MOCK DATA
// =============================================================================

type SpeedType = "fast" | "mid" | "slow" | "timeout";
type ThemeType = "MOVIES" | "FOOTBALL" | "ANIME" | "CRYPTO" | "POLITICS" | "GENERAL";

interface MockResult {
  score: number;
  rank: number;
  totalPlayers: number;
  correctCount: number;
  totalQuestions: number;
  bestStreak: number;
  speeds: SpeedType[];
  correct: boolean[];
  gameNumber: number;
  theme: ThemeType;
  badges: Badge[];
  archetype: PlayerArchetype;
}

interface Badge {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
  rarity: "common" | "rare" | "legendary";
}

interface PlayerArchetype {
  title: string;
  icon: string;
  description: string;
  color: string;
}

const MOCK_PLAYERS = [
  { username: "vitalik.eth", pfp: "https://i.pravatar.cc/80?u=vitalik", score: 4200, rank: 1 },
  { username: "trivia_queen", pfp: "https://i.pravatar.cc/80?u=queen", score: 3800, rank: 2 },
  { username: "0xbob", pfp: "https://i.pravatar.cc/80?u=0xbob", score: 3500, rank: 3 },
  { username: "degen.fc", pfp: "https://i.pravatar.cc/80?u=degen", score: 3200, rank: 4 },
  { username: "moonboy", pfp: "https://i.pravatar.cc/80?u=moon", score: 2900, rank: 5 },
];

// =============================================================================
// BADGES
// =============================================================================

const BADGE_DEFS = {
  speed_demon: { id: "speed_demon", icon: "⚡", label: "SPEED DEMON", description: "3+ fast answers", color: "#14B985", rarity: "rare" as const },
  streak_master: { id: "streak_master", icon: "🔥", label: "STREAK MASTER", description: "3+ answer streak", color: "#FFC931", rarity: "rare" as const },
  perfect_round: { id: "perfect_round", icon: "💎", label: "PERFECT ROUND", description: "All correct", color: "#B01BF5", rarity: "legendary" as const },
  quick_draw: { id: "quick_draw", icon: "🎯", label: "QUICK DRAW", description: "First answer was fast + correct", color: "#00CFF2", rarity: "common" as const },
  clutch_player: { id: "clutch_player", icon: "🫡", label: "CLUTCH PLAYER", description: "Last answer saved you", color: "#FF6B35", rarity: "common" as const },
  survivor: { id: "survivor", icon: "🛡️", label: "SURVIVOR", description: "Answered every question", color: "#99A0AE", rarity: "common" as const },
  no_chill: { id: "no_chill", icon: "🧊", label: "NO CHILL", description: "Average speed under 3s", color: "#1B8FF5", rarity: "rare" as const },
  participation: { id: "participation", icon: "🏳️", label: "YOU TRIED", description: "At least you showed up", color: "#666", rarity: "common" as const },
};

function computeBadges(result: { speeds: SpeedType[]; correct: boolean[]; bestStreak: number; correctCount: number; totalQuestions: number }): Badge[] {
  const badges: Badge[] = [];
  const fastCount = result.speeds.filter((s, i) => s === "fast" && result.correct[i]).length;
  const timeoutCount = result.speeds.filter(s => s === "timeout").length;

  if (result.correctCount === result.totalQuestions) badges.push(BADGE_DEFS.perfect_round);
  if (fastCount >= 3) badges.push(BADGE_DEFS.speed_demon);
  if (result.bestStreak >= 3) badges.push(BADGE_DEFS.streak_master);
  if (result.speeds[0] === "fast" && result.correct[0]) badges.push(BADGE_DEFS.quick_draw);
  if (timeoutCount === 0) badges.push(BADGE_DEFS.survivor);
  if (result.correct[result.correct.length - 1] && result.speeds[result.speeds.length - 1] === "slow") badges.push(BADGE_DEFS.clutch_player);
  if (fastCount >= 2) badges.push(BADGE_DEFS.no_chill);
  if (badges.length === 0) badges.push(BADGE_DEFS.participation);

  return badges.slice(0, 4);
}

// =============================================================================
// PLAYER ARCHETYPES
// =============================================================================

const ARCHETYPES: Record<ThemeType, PlayerArchetype> = {
  MOVIES: { title: "CINEMA BUFF", icon: "🎬", description: "You live and breathe movies", color: "#FFC931" },
  FOOTBALL: { title: "FOOTBALL BRAIN", icon: "⚽", description: "Stats, lineups, you know it all", color: "#14B985" },
  ANIME: { title: "ANIME LORD", icon: "🍥", description: "Your power level is over 9000", color: "#FB72FF" },
  CRYPTO: { title: "DEGEN SCHOLAR", icon: "💰", description: "On-chain knowledge diff", color: "#00CFF2" },
  POLITICS: { title: "POLICY NERD", icon: "🏛️", description: "You follow the discourse", color: "#FF6B35" },
  GENERAL: { title: "TRIVIA GENERALIST", icon: "🧠", description: "Jack of all knowledge", color: "#99A0AE" },
};

// =============================================================================
// ROAST / HYPE MESSAGES
// =============================================================================

const resultMessages = {
  dominant: [
    "DISGUSTING PERFORMANCE",
    "THEY DIDN'T STAND A CHANCE",
    "SAVE SOME FOR THE REST OF US",
    "MAIN CHARACTER ENERGY",
    "WOKE UP AND CHOSE VIOLENCE",
    "CLEAR THE LOBBY",
  ],
  strong: [
    "SOLID RUN",
    "RESPECT",
    "NOT BAD AT ALL",
    "YOU CAME PREPARED",
    "CLEAN EXECUTION",
    "HEART RATE: 180",
  ],
  close: [
    "SO CLOSE IT HURTS",
    "PAIN. JUST PAIN.",
    "THE UNIVERSE OWES YOU ONE",
    "ALMOST HAD IT",
    "THAT STINGS",
    "AGONY",
  ],
  mid: [
    "ROOM FOR IMPROVEMENT... A LOT OF ROOM",
    "YOUR OPPONENTS SEND THEIR THANKS",
    "PARTICIPATION TROPHY INCOMING",
    "NOT YOUR DAY",
    "YOU TRIED. THAT'S... SOMETHING",
    "MID",
  ],
  bad: [
    "WHAT WAS THAT",
    "UNINSTALL",
    "DID YOU EVEN TRY?",
    "EMBARRASSING",
    "THE BOTS OUTPLAYED YOU",
    "DELETE YOUR ACCOUNT",
    "YOUR PHONE DESERVES BETTER",
  ],
  timeout_heavy: [
    "HALF THE GAME YOU WERE AFK",
    "YOUR SCREEN WAS ON BUT NOBODY WAS HOME",
    "DID YOU FALL ASLEEP HALFWAY?",
    "ATTENDANCE: PARTIAL",
  ],
} as const;

function getResultMessage(result: MockResult): { text: string; color: string } {
  const percentile = ((result.totalPlayers - result.rank) / (result.totalPlayers - 1)) * 100;
  const timeoutCount = result.speeds.filter(s => s === "timeout").length;

  const pool = (() => {
    if (timeoutCount >= result.totalQuestions / 2) return resultMessages.timeout_heavy;
    if (percentile > 90) return resultMessages.dominant;
    if (percentile > 70) return resultMessages.strong;
    if (percentile > 50) return resultMessages.close;
    if (percentile > 25) return resultMessages.mid;
    return resultMessages.bad;
  })();

  const text = pool[Math.floor(Math.random() * pool.length)];
  const color = percentile > 70 ? "#14B985" : percentile > 40 ? "#FFC931" : "#FF6B6B";
  return { text, color };
}

// =============================================================================
// SCORE COUNTUP
// =============================================================================

function ScoreCountup({ target, duration = 2000, onComplete }: { target: number; duration?: number; onComplete?: () => void }) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const completed = useRef(false);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else if (!completed.current) {
        completed.current = true;
        onComplete?.();
      }
    };
    requestAnimationFrame(animate);
  }, [target, duration, onComplete]);

  return <>{value.toLocaleString()}</>;
}

// =============================================================================
// SPEED DOT
// =============================================================================

const speedColors = { fast: "#14B985", mid: "#FFC931", slow: "#FF6B6B", timeout: "#FF4444" };

function SpeedDot({ speed, correct, index, delay }: { speed: SpeedType; correct: boolean; index: number; delay: number }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-1"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 20, delay }}
    >
      <motion.div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: 36, height: 36,
          backgroundColor: correct ? speedColors[speed] + "20" : "#FF444420",
          border: `2px solid ${correct ? speedColors[speed] : "#FF4444"}`,
        }}
      >
        <span className="font-body text-[13px]" style={{ color: correct ? speedColors[speed] : "#FF4444" }}>
          {correct ? (speed === "fast" ? "F" : speed === "mid" ? "M" : "S") : "X"}
        </span>
      </motion.div>
      <span className="font-display text-[9px] text-[#99A0AE]">Q{index + 1}</span>
    </motion.div>
  );
}

// =============================================================================
// BADGE CARD
// =============================================================================

const rarityGlow = {
  common: "none",
  rare: "0 0 12px rgba(255,201,49,0.3)",
  legendary: "0 0 20px rgba(176,27,245,0.4), 0 0 40px rgba(176,27,245,0.2)",
};

function BadgeCard({ badge, delay }: { badge: Badge; delay: number }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border"
      style={{
        backgroundColor: badge.color + "10",
        borderColor: badge.color + "30",
        boxShadow: rarityGlow[badge.rarity],
        minWidth: 90,
      }}
      initial={{ scale: 0, opacity: 0, rotateY: 90 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 15, delay }}
    >
      <motion.span
        className="text-2xl"
        animate={badge.rarity === "legendary" ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] } : {}}
        transition={badge.rarity === "legendary" ? { duration: 2, repeat: Infinity, repeatDelay: 1 } : {}}
      >
        {badge.icon}
      </motion.span>
      <span className="font-body text-[11px] text-white text-center leading-tight">{badge.label}</span>
      <span className="font-display text-[8px] text-center" style={{ color: badge.color }}>{badge.description}</span>
      {badge.rarity !== "common" && (
        <span
          className="font-display text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: badge.color + "20", color: badge.color }}
        >
          {badge.rarity}
        </span>
      )}
    </motion.div>
  );
}

// =============================================================================
// ARCHETYPE CARD
// =============================================================================

function ArchetypeCard({ archetype, delay }: { archetype: PlayerArchetype; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-3 p-3 rounded-xl border w-full"
      style={{
        backgroundColor: archetype.color + "08",
        borderColor: archetype.color + "25",
      }}
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 20, delay }}
    >
      <motion.span
        className="text-3xl"
        animate={{ rotate: [0, -8, 8, 0] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
      >
        {archetype.icon}
      </motion.span>
      <div className="flex flex-col gap-0.5">
        <span className="font-body text-[18px] leading-tight" style={{ color: archetype.color }}>
          {archetype.title}
        </span>
        <span className="font-display text-[11px] text-[#99A0AE]">{archetype.description}</span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// STREAK BADGE
// =============================================================================

function StreakBadge({ streak, delay }: { streak: number; delay: number }) {
  if (streak < 2) return null;
  return (
    <motion.div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{ backgroundColor: "rgba(255,201,49,0.12)", border: "1px solid rgba(255,201,49,0.3)" }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 15, delay }}
    >
      <span className="text-base">🔥</span>
      <span className="font-body text-[16px] text-[#FFC931]">BEST STREAK: {streak}</span>
    </motion.div>
  );
}

// =============================================================================
// MAIN
// =============================================================================

export default function ResultSamplePage() {
  const [scenario, setScenario] = useState<"top" | "mid" | "bad" | null>(null);
  const [result, setResult] = useState<MockResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "countup" | "reveal" | "badges" | "full">("idle");
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);
  const hasPlayedSound = useRef(false);

  const themes: ThemeType[] = ["MOVIES", "FOOTBALL", "ANIME", "CRYPTO", "POLITICS", "GENERAL"];

  const buildResult = useCallback((type: "top" | "mid" | "bad"): MockResult => {
    const totalQuestions = 5;
    const speeds: SpeedType[] = [];
    const correct: boolean[] = [];
    const theme = themes[Math.floor(Math.random() * themes.length)];

    if (type === "top") {
      for (let i = 0; i < totalQuestions; i++) {
        const r = Math.random();
        correct.push(r > 0.1);
        speeds.push(r > 0.5 ? "fast" : r > 0.2 ? "mid" : "slow");
      }
    } else if (type === "mid") {
      for (let i = 0; i < totalQuestions; i++) {
        const r = Math.random();
        correct.push(r > 0.4);
        speeds.push(r > 0.4 ? "mid" : r > 0.15 ? "slow" : "timeout");
      }
    } else {
      for (let i = 0; i < totalQuestions; i++) {
        const r = Math.random();
        correct.push(r > 0.7);
        speeds.push(r > 0.4 ? "timeout" : r > 0.2 ? "slow" : "mid");
      }
    }

    let bestStreak = 0, currentStreak = 0;
    for (const c of correct) {
      if (c) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
      else { currentStreak = 0; }
    }

    const correctCount = correct.filter(Boolean).length;
    const baseScore = correctCount * 800;
    const speedBonus = speeds.reduce((acc, s, i) => {
      if (!correct[i]) return acc;
      return acc + (s === "fast" ? 300 : s === "mid" ? 150 : s === "slow" ? 50 : 0);
    }, 0);
    const streakBonus = bestStreak >= 3 ? bestStreak * 200 : 0;
    const score = baseScore + speedBonus + streakBonus;

    const rank = type === "top" ? Math.floor(Math.random() * 3) + 1
      : type === "mid" ? Math.floor(Math.random() * 10) + 8
      : Math.floor(Math.random() * 10) + 22;

    const partialResult = { speeds, correct, bestStreak, correctCount, totalQuestions };
    const badges = computeBadges(partialResult);

    return {
      score, rank, totalPlayers: 32, correctCount, totalQuestions,
      bestStreak, speeds, correct, gameNumber: 42, theme,
      badges, archetype: ARCHETYPES[theme],
    };
  }, []);

  const startScenario = useCallback((type: "top" | "mid" | "bad") => {
    const r = buildResult(type);
    setResult(r);
    setScenario(type);
    setMessage(getResultMessage(r));
    setPhase("countup");
    hasPlayedSound.current = false;
  }, [buildResult]);

  useEffect(() => {
    if (phase === "countup" && result && !hasPlayedSound.current) {
      hasPlayedSound.current = true;
      playSound(result.rank <= 5 ? "victory" : "defeat");
    }
  }, [phase, result]);

  const handleCountupComplete = useCallback(() => {
    setTimeout(() => setPhase("reveal"), 300);
    setTimeout(() => setPhase("badges"), 1200);
    setTimeout(() => setPhase("full"), 2200);
  }, []);

  const handleReset = () => {
    setScenario(null);
    setResult(null);
    setPhase("idle");
    setMessage(null);
    hasPlayedSound.current = false;
  };

  return (
    <div className="app-background min-h-dvh flex flex-col items-center relative overflow-y-auto">

      {/* Scenario picker */}
      {phase === "idle" && (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center gap-6 px-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-body text-[28px] text-white text-center leading-[0.92]">RESULT PAGE DEMO</h1>
          <p className="font-display text-xs text-[#99A0AE] text-center max-w-xs">
            Pick a scenario to preview the post-game result experience.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[300px]">
            {([
              { type: "top" as const, label: "TOP PLAYER", color: "#14B985" },
              { type: "mid" as const, label: "MIDDLE PACK", color: "#FFC931" },
              { type: "bad" as const, label: "BOTTOM TIER", color: "#FF4444" },
            ]).map(({ type, label, color }) => (
              <motion.button
                key={type}
                className="w-full py-4 rounded-xl font-body text-xl"
                style={{ backgroundColor: color, color: type === "bad" ? "white" : "#1E1E1E" }}
                onClick={() => startScenario(type)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Result screen */}
      {result && phase !== "idle" && (
        <div className="w-full max-w-xl mx-auto flex-1 flex flex-col px-4 pt-4 pb-8">

          {/* Header */}
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.webp" alt="Waffles" className="w-[30px] h-[24px] object-contain" />
              <span className="font-body text-[22px] leading-[92%] tracking-[-0.03em] text-white">WAFFLES</span>
              <span className="font-body text-[18px] leading-[92%] tracking-[-0.03em] text-white/50">
                #{String(result.gameNumber).padStart(3, "0")}
              </span>
            </div>
            <button onClick={handleReset} className="font-display text-xs text-[#99A0AE] hover:text-white transition-colors">
              RESET
            </button>
          </header>

          {/* Roast / Hype */}
          <AnimatePresence>
            {message && (
              <motion.div className="mb-4" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <motion.p
                  className="font-body text-[24px] leading-[0.92] text-center tracking-[-0.02em]"
                  style={{ color: message.color }}
                  animate={result.rank <= 3 ? {
                    textShadow: [`0 0 0px ${message.color}00`, `0 0 20px ${message.color}80`, `0 0 0px ${message.color}00`],
                  } : {}}
                  transition={result.rank <= 3 ? { duration: 2, repeat: Infinity } : {}}
                >
                  {message.text}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Score */}
          <motion.div className="flex flex-col items-center gap-2 mb-5" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <span className="font-display text-[12px] text-[#99A0AE] tracking-wider uppercase">Score</span>
            <motion.span className="font-body text-[56px] leading-[0.9] text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              <ScoreCountup target={result.score} duration={result.rank <= 5 ? 2500 : 1500} onComplete={handleCountupComplete} />
            </motion.span>

            {/* Rank */}
            <motion.div
              className="flex items-center gap-1.5 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase !== "countup" ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className="font-display text-[12px] text-[#99A0AE]">RANK</span>
              <span className="font-body text-[20px] text-white">{result.rank}/{result.totalPlayers}</span>
              <span className="font-display text-[11px] text-[#99A0AE] ml-1">
                top {Math.max(1, Math.round(((result.totalPlayers - result.rank) / (result.totalPlayers - 1)) * 100))}%
              </span>
            </motion.div>
          </motion.div>

          {/* Player archetype */}
          <AnimatePresence>
            {(phase === "reveal" || phase === "badges" || phase === "full") && (
              <motion.div className="mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ArchetypeCard archetype={result.archetype} delay={0.1} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Question breakdown */}
          <AnimatePresence>
            {(phase === "reveal" || phase === "badges" || phase === "full") && (
              <motion.div className="mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-[11px] text-[#99A0AE] tracking-wider uppercase">Breakdown</span>
                  <span className="font-body text-[14px] text-white">{result.correctCount}/{result.totalQuestions} correct</span>
                </div>
                <div className="flex justify-center gap-3">
                  {result.speeds.map((speed, i) => (
                    <SpeedDot key={i} speed={speed} correct={result.correct[i]} index={i} delay={0.1 + i * 0.08} />
                  ))}
                </div>
                <div className="flex justify-center gap-4 mt-3">
                  {(["fast", "mid", "slow"] as const).map((s) => (
                    <div key={s} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: speedColors[s] }} />
                      <span className="font-display text-[9px] text-[#99A0AE] uppercase">{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Streak */}
          <AnimatePresence>
            {(phase === "reveal" || phase === "badges" || phase === "full") && (
              <motion.div className="flex justify-center mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <StreakBadge streak={result.bestStreak} delay={0.5} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Badges */}
          <AnimatePresence>
            {(phase === "badges" || phase === "full") && result.badges.length > 0 && (
              <motion.div className="mb-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="font-display text-[11px] text-[#99A0AE] tracking-wider uppercase block mb-3">
                  Badges Earned
                </span>
                <div className="flex gap-2 justify-center flex-wrap">
                  {result.badges.map((badge, i) => (
                    <BadgeCard key={badge.id} badge={badge} delay={0.1 + i * 0.15} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Leaderboard */}
          <AnimatePresence>
            {phase === "full" && (
              <motion.div className="mb-5" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <span className="font-display text-[11px] text-[#99A0AE] tracking-wider uppercase block mb-3">Leaderboard</span>
                <div className="flex flex-col gap-2">
                  {MOCK_PLAYERS.slice(0, 3).map((player, i) => (
                    <motion.div
                      key={player.username}
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-white/8"
                      style={{
                        background: i === 0 ? "linear-gradient(90deg, transparent, rgba(52,199,89,0.08))"
                          : i === 1 ? "linear-gradient(90deg, transparent, rgba(25,171,211,0.08))"
                          : "linear-gradient(90deg, transparent, rgba(211,77,25,0.08))",
                      }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.12 }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/images/trophies/${i === 0 ? "gold" : i === 1 ? "silver" : "bronze"}.svg`} alt="" className="w-[20px] h-[26px]" />
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-[#D9D9D9] flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={player.pfp} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-body text-[16px] text-white flex-1 truncate">{player.username}</span>
                      <span className="font-body text-[16px] text-white tabular-nums">{player.score.toLocaleString()}</span>
                    </motion.div>
                  ))}

                  {result.rank > 3 && (
                    <motion.div
                      className="flex items-center gap-3 p-2.5 rounded-xl border border-[#FFC931]/30"
                      style={{ background: "rgba(255,201,49,0.06)" }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <span className="font-body text-[14px] text-[#99A0AE] w-[20px] text-center">{result.rank}</span>
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-[#F5BB1B] to-[#FF6B35] flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="https://i.pravatar.cc/80?u=you" alt="" className="w-full h-full object-cover" />
                      </div>
                      <span className="font-body text-[16px] text-[#FFC931] flex-1">YOU</span>
                      <span className="font-body text-[16px] text-white tabular-nums">{result.score.toLocaleString()}</span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom CTAs */}
          <AnimatePresence>
            {phase === "full" && (
              <motion.div className="flex flex-col gap-3 mt-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <NextGameCountdown />
                <div className="flex gap-3">
                  <motion.button
                    className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 font-body text-[16px] text-white"
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    SHARE SCORE
                  </motion.button>
                  <motion.button
                    className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 font-body text-[16px] text-white"
                    onClick={handleReset}
                    whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.15)" }}
                    whileTap={{ scale: 0.97 }}
                  >
                    BACK TO HOME
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Confetti for top players */}
      {result && result.rank <= 3 && phase !== "idle" && <ConfettiOverlay />}
    </div>
  );
}

// =============================================================================
// NEXT GAME COUNTDOWN
// =============================================================================

function NextGameCountdown() {
  const [seconds, setSeconds] = useState(7200);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return (
    <motion.div
      className="w-full py-3 rounded-xl font-body text-center"
      style={{
        background: "linear-gradient(90deg, rgba(0,207,242,0.08), rgba(255,201,49,0.08))",
        border: "1px solid rgba(255,201,49,0.2)",
      }}
      animate={{ borderColor: ["rgba(255,201,49,0.2)", "rgba(0,207,242,0.3)", "rgba(255,201,49,0.2)"] }}
      transition={{ duration: 4, repeat: Infinity }}
    >
      <span className="text-[12px] text-[#99A0AE] block font-display tracking-wider uppercase">Next game in</span>
      <span className="text-[22px] text-white">{hrs}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}</span>
    </motion.div>
  );
}

// =============================================================================
// CONFETTI
// =============================================================================

function ConfettiOverlay() {
  const colors = ["#FFC931", "#14B985", "#FB72FF", "#00CFF2", "#FF6B6B"];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i, color: colors[i % colors.length],
    left: Math.random() * 100, delay: Math.random() * 2,
    duration: 2 + Math.random() * 2, size: 6 + Math.random() * 6,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size * 0.6, backgroundColor: p.color, left: `${p.left}%`, top: -10 }}
          initial={{ y: -10, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: Math.random() > 0.5 ? 720 : -720, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
