const MS_PER_DAY = 86_400_000;

export const dayKeyUTC = (d = new Date()): string => d.toISOString().slice(0, 10);

export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_DAY);

type LoginStreakInput = {
  currentStreak: number;
  bestStreak: number;
  lastLoginAt: Date | null;
};

export type ResolvedLoginStreak = {
  currentStreak: number;
  bestStreak: number;
  lastLoginAt: Date;
  changed: boolean;
};

export function resolveLoginStreak(
  user: LoginStreakInput,
  now = new Date(),
): ResolvedLoginStreak {
  const today = dayKeyUTC(now);
  const lastLoginDay = user.lastLoginAt ? dayKeyUTC(user.lastLoginAt) : null;

  if (lastLoginDay === today) {
    return {
      currentStreak: user.currentStreak,
      bestStreak: user.bestStreak,
      lastLoginAt: user.lastLoginAt ?? now,
      changed: false,
    };
  }

  const currentStreak =
    lastLoginDay && daysBetween(lastLoginDay, today) === 1
      ? Math.max(user.currentStreak, 0) + 1
      : 1;

  return {
    currentStreak,
    bestStreak: Math.max(user.bestStreak, currentStreak),
    lastLoginAt: now,
    changed: true,
  };
}
