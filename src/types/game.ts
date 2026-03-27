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

export const THEME_LABELS: Record<GameTheme, { emoji: string; label: string }> = {
  FOOTBALL: { emoji: "⚽", label: "Football" },
  MOVIES: { emoji: "🎬", label: "Movies" },
  ANIME: { emoji: "🎌", label: "Anime" },
  POLITICS: { emoji: "🏛️", label: "Politics" },
  CRYPTO: { emoji: "₿", label: "Crypto" },
  GENERAL: { emoji: "🌐", label: "General" },
};

export const DIFFICULTY_STYLES: Record<Difficulty, { bg: string; text: string }> = {
  EASY: { bg: "bg-green-500/20", text: "text-green-400" },
  MEDIUM: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  HARD: { bg: "bg-red-500/20", text: "text-red-400" },
};
