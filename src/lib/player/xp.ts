export const SCORE_XP_DIVISOR = 10;

export function scoreToXp(score: number, multiplier = 1): number {
  const scaled = Math.round((Math.max(0, score) * Math.max(0, multiplier)) / SCORE_XP_DIVISOR);
  return score > 0 && multiplier > 0 ? Math.max(1, scaled) : 0;
}
