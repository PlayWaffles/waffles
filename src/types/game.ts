export const GAME_THEMES = [
  "FOOTBALL",
  "MOVIES",
  "ANIME",
  "POLITICS",
  "CRYPTO",
  "GENERAL",
] as const;

export type GameTheme = (typeof GAME_THEMES)[number];

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];
