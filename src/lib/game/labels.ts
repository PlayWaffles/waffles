import type { GameTheme } from "@prisma";

export function formatGameLabel(gameNumber: number | null | undefined): string {
  return `Waffles #${String(gameNumber ?? 0).padStart(3, "0")}`;
}

// Theme → display base for the title (the game's question theme).
const THEME_TITLE: Record<GameTheme, string> = {
  FOOTBALL: "World Cup",
  MOVIES: "Movie Night",
  ANIME: "Anime",
  POLITICS: "Politics",
  CRYPTO: "Crypto",
  GENERAL: "Trivia",
};

// Flavor words cycled deterministically by game number — gives each game a
// distinct, memorable name that's still stable/reproducible (same number →
// same name), not random.
const TITLE_FLAVORS = [
  "Showdown", "Rush", "Blitz", "Clash", "Sprint", "Gauntlet",
  "Royale", "Frenzy", "Dash", "Cup", "Bowl", "Scramble",
];

/**
 * Hybrid auto-generated game title: theme base + a number-seeded flavor word +
 * the stable `#NNN` id. e.g. "Movie Night Blitz #043", "World Cup Cup #044".
 */
export function generateGameTitle(input: { gameNumber: number; theme: GameTheme }): string {
  const base = THEME_TITLE[input.theme] ?? "Trivia";
  // Avoid a base/flavor clash like "World Cup Cup" — skip to the next flavor.
  let flavor = TITLE_FLAVORS[input.gameNumber % TITLE_FLAVORS.length];
  if (base.endsWith(flavor)) {
    flavor = TITLE_FLAVORS[(input.gameNumber + 1) % TITLE_FLAVORS.length];
  }
  return `${base} ${flavor} #${String(input.gameNumber).padStart(3, "0")}`;
}

export function formatAdminGameLabel(
  title: string | null | undefined,
  platform: string | null | undefined,
): string {
  const baseTitle = title?.trim() || "Untitled Game";
  if (!platform) return baseTitle;

  const platformLabel =
    platform === "MINIPAY"
      ? "MiniPay"
      : platform === "FARCASTER"
        ? "Farcaster"
        : platform === "BASE_APP"
          ? "Base App"
          : platform;

  return `${baseTitle} • ${platformLabel}`;
}
