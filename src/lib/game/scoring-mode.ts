/**
 * Tournament game detection — distinguishes short tournament windows from
 * legacy day-long games still in the DB (historical entries only).
 */

export const TOURNAMENT_WINDOW_MS = 4 * 60 * 60 * 1000;

const MAX_TOURNAMENT_GAME_MS = 2 * TOURNAMENT_WINDOW_MS;

export function isTournamentGame(game: {
  startsAt: Date;
  endsAt: Date;
}): boolean {
  const durationMs = game.endsAt.getTime() - game.startsAt.getTime();
  return durationMs <= MAX_TOURNAMENT_GAME_MS;
}