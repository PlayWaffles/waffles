import type { UserPlatform } from "@prisma";
import type { Prisma } from "@prisma";
import { env } from "@/lib/env";

function prefersTestnetGames() {
  return process.env.NODE_ENV !== "production" && env.rootUrl.includes("localhost");
}

export function sharesBaseMainnetGames(platform: UserPlatform): boolean {
  return platform === "FARCASTER" || platform === "BASE_APP";
}

export function gamePlatformsForPlatform(platform: UserPlatform): UserPlatform[] {
  return sharesBaseMainnetGames(platform)
    ? ["FARCASTER", "BASE_APP"]
    : [platform];
}

export function excludesTestnet(platform: UserPlatform): boolean {
  return sharesBaseMainnetGames(platform) && !prefersTestnetGames();
}

export function isGameVisibleToPlatform(
  game: { platform: UserPlatform; isTestnet: boolean },
  platform: UserPlatform,
): boolean {
  return (
    gamePlatformsForPlatform(platform).includes(game.platform) &&
    (!game.isTestnet || !excludesTestnet(platform))
  );
}

/** Prisma where fragment: scope a Game query to a platform */
export function gameWhere(platform: UserPlatform): Prisma.GameWhereInput {
  const platforms = gamePlatformsForPlatform(platform);
  const platformWhere =
    platforms.length === 1 ? { platform } : { platform: { in: platforms } };
  if (sharesBaseMainnetGames(platform) && prefersTestnetGames()) {
    return { ...platformWhere, isTestnet: true };
  }

  return excludesTestnet(platform) ? { ...platformWhere, isTestnet: false } : platformWhere;
}

/** Prisma where fragment: scope a GameEntry query to a platform's games */
export function entryWhere(platform: UserPlatform): { game: Prisma.GameWhereInput } {
  return { game: gameWhere(platform) };
}
