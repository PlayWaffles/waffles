import type { UserPlatform } from "@prisma";
import type { Prisma } from "@prisma";

export function excludesTestnet(platform: UserPlatform): boolean {
  return platform === "FARCASTER";
}

export function isGameVisibleToPlatform(
  game: { platform: UserPlatform; isTestnet: boolean },
  platform: UserPlatform,
): boolean {
  return game.platform === platform && (!game.isTestnet || !excludesTestnet(platform));
}

/** Prisma where fragment: scope a Game query to a platform */
export function gameWhere(platform: UserPlatform): Prisma.GameWhereInput {
  return excludesTestnet(platform) ? { platform, isTestnet: false } : { platform };
}

/** Prisma where fragment: scope a GameEntry query to a platform's games */
export function entryWhere(platform: UserPlatform): { game: Prisma.GameWhereInput } {
  return { game: gameWhere(platform) };
}
