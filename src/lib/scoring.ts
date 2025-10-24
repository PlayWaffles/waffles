export function calculateScore(timeTaken: number, maxTime: number): number {
  if (!Number.isFinite(maxTime) || maxTime <= 0) return 0;
  const clampedTime = Math.min(Math.max(0, timeTaken), maxTime);
  const speedRatio = (maxTime - clampedTime) / maxTime;
  const basePoints = 300 + speedRatio * 2700; // between 300–3000
  return Math.max(0, Math.round(basePoints));
}

export function isMatch(choiceId: number, targetId: number): boolean {
  // In real version: compare identifiers for correct pair
  return choiceId === targetId;
}
