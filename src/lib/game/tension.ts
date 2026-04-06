/**
 * Tension UI feedback system for live game questions.
 *
 * Speed-based feedback messages, streak tracking, and speed tier calculation.
 */

// =============================================================================
// TYPES
// =============================================================================

export type SpeedTier = "fast" | "mid" | "slow" | "timeout";

export interface AnswerFeedback {
  text: string;
  color: string;
}

export interface AnswerResult {
  isCorrect: boolean;
  speedTier: SpeedTier;
  feedback: AnswerFeedback;
  pointsEarned: number;
}

// =============================================================================
// FEEDBACK MESSAGES
// =============================================================================

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

// Track used messages per game session to avoid repeats
const usedMessages = new Set<string>();

export function resetFeedbackMessages() {
  usedMessages.clear();
}

function pickUnique(pool: readonly string[]): string {
  const available = pool.filter((m) => !usedMessages.has(m));
  const pick =
    available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : pool[Math.floor(Math.random() * pool.length)];
  usedMessages.add(pick);
  return pick;
}

// =============================================================================
// SPEED TIER CALCULATION
// =============================================================================

export const speedTierMeta = {
  fast: { label: "FAST", color: "#14B985" },
  mid: { label: "OK", color: "#FFC931" },
  slow: { label: "SLOW", color: "#FF6B6B" },
  timeout: { label: "MISSED", color: "#FF4444" },
} as const;

/**
 * Compute speed tier from time taken vs question duration.
 * fast = answered in first 40% of time, mid = 40-70%, slow = 70-100%
 */
export function getSpeedTier(
  timeTakenMs: number,
  durationSec: number,
): SpeedTier {
  const ratio = 1 - timeTakenMs / (durationSec * 1000);
  if (ratio > 0.6) return "fast";
  if (ratio > 0.3) return "mid";
  return "slow";
}

// =============================================================================
// FEEDBACK MESSAGE GENERATION
// =============================================================================

export function getAnswerFeedback(
  speedTier: SpeedTier,
  streak: number,
  isCorrect: boolean,
): AnswerFeedback {
  if (streak >= 3 && isCorrect) {
    return { text: pickUnique(answerFeedback.streak), color: "#FF4444" };
  }
  if (speedTier === "fast") {
    return isCorrect
      ? { text: pickUnique(answerFeedback.fast_correct), color: "#14B985" }
      : { text: pickUnique(answerFeedback.fast_wrong), color: "#FF6B6B" };
  }
  if (speedTier === "mid") {
    return isCorrect
      ? { text: pickUnique(answerFeedback.mid_correct), color: "#FFC931" }
      : { text: pickUnique(answerFeedback.mid_wrong), color: "#FF6B6B" };
  }
  if (speedTier === "slow") {
    return isCorrect
      ? { text: pickUnique(answerFeedback.slow_correct), color: "#14B985" }
      : { text: pickUnique(answerFeedback.slow_wrong), color: "#FF6B6B" };
  }
  return { text: pickUnique(answerFeedback.timeout), color: "#FF4444" };
}

export function getTimeoutFeedback(): AnswerFeedback {
  return { text: pickUnique(answerFeedback.timeout), color: "#FF4444" };
}
