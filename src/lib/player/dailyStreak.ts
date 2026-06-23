const MS_PER_DAY = 86_400_000;

export const dayKeyUTC = (d = new Date()): string => d.toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);

// The daily-reward CLAIM is the streak authority — opening the app no longer
// advances or breaks a streak. The streak is reconstructed from the player's
// claim history (DailyRewardClaim) plus their stored streak, and Streak Freezes
// bridge missed days so a lapse doesn't reset a paid-for streak.

type ClaimStreakInput = {
  /** Streak recorded at the most recent claim (User.currentStreak). */
  currentStreak: number;
  /** Freezes the player currently holds. */
  streakFreezes: number;
  /** dayKey of the most recent PRIOR claim (never today), or null if none. */
  lastClaimDay: string | null;
};

export type ClaimStreakResolution = {
  /** The streak after claiming today. */
  streak: number;
  /** Freezes consumed to bridge missed days (0 when none needed). */
  freezesUsed: number;
  /** Whether the prior streak was continued (vs. reset to 1). */
  continued: boolean;
};

/** Resolve what claiming today does to the streak, given the last claim day and
 *  available freezes. Caller must have already ensured today isn't claimed yet. */
export function resolveClaimStreak(
  input: ClaimStreakInput,
  today = dayKeyUTC(),
): ClaimStreakResolution {
  const { currentStreak, streakFreezes, lastClaimDay } = input;

  // First claim ever — start the streak.
  if (lastClaimDay === null) {
    return { streak: 1, freezesUsed: 0, continued: false };
  }

  const missed = Math.max(0, daysBetween(lastClaimDay, today) - 1);

  // Claimed yesterday — a clean consecutive day.
  if (missed === 0) {
    return { streak: Math.max(currentStreak, 0) + 1, freezesUsed: 0, continued: true };
  }

  // Missed one or more days, but freezes can bridge every missed day.
  if (streakFreezes >= missed) {
    return { streak: Math.max(currentStreak, 0) + 1, freezesUsed: missed, continued: true };
  }

  // Gap too large for the freezes on hand — the streak resets.
  return { streak: 1, freezesUsed: 0, continued: false };
}

/** The streak to DISPLAY without mutating anything (app-open / read paths).
 *  Returns the streak the player currently holds — their stored streak while it
 *  is still alive (claimed today/yesterday, or a gap their freezes will cover),
 *  or 0 once it has lapsed beyond what freezes can save. Does NOT include today
 *  until today has actually been claimed. */
export function displayStreak(
  input: ClaimStreakInput,
  today = dayKeyUTC(),
): number {
  const { currentStreak, streakFreezes, lastClaimDay } = input;
  if (lastClaimDay === null) return 0;
  if (lastClaimDay === today) return currentStreak; // already counts today
  const missed = Math.max(0, daysBetween(lastClaimDay, today) - 1);
  if (missed === 0) return currentStreak; // claimed yesterday — intact
  if (streakFreezes >= missed) return currentStreak; // a freeze will bridge it
  return 0; // lapsed beyond freeze coverage
}
