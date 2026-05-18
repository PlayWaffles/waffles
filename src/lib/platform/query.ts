import type { UserPlatform } from "@prisma";
import type { Prisma } from "@prisma";
import type { GameNetwork } from "@/lib/chain/network";
import { isLocalDevelopmentDeployment } from "@/lib/deployment";

export interface GameVisibilityOptions {
  includeTestnet?: boolean;
}

function prefersTestnetGames() {
  return isLocalDevelopmentDeployment();
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

function hidesMiniPayTestnet(options?: GameVisibilityOptions) {
  return options?.includeTestnet !== true;
}

function miniPayNetworks(options?: GameVisibilityOptions): GameNetwork | { in: GameNetwork[] } {
  return hidesMiniPayTestnet(options)
    ? "CELO_MAINNET"
    : { in: ["CELO_MAINNET", "CELO_SEPOLIA"] };
}

export function isGameVisibleToPlatform(
  game: { platform: UserPlatform; isTestnet: boolean; network?: GameNetwork | null },
  platform: UserPlatform,
  options?: GameVisibilityOptions,
): boolean {
  if (platform === "MINIPAY") {
    const allowedNetworks = miniPayNetworks(options);
    const networkMatches =
      typeof allowedNetworks === "string"
        ? game.network === allowedNetworks
        : !!game.network && allowedNetworks.in.includes(game.network);

    return game.platform === platform && networkMatches;
  }

  return (
    gamePlatformsForPlatform(platform).includes(game.platform) &&
    (!game.isTestnet || !excludesTestnet(platform))
  );
}

/** Prisma where fragment: scope a Game query to a platform */
export function gameWhere(
  platform: UserPlatform,
  options?: GameVisibilityOptions,
): Prisma.GameWhereInput {
  const platforms = gamePlatformsForPlatform(platform);
  const platformWhere =
    platforms.length === 1 ? { platform } : { platform: { in: platforms } };
  if (sharesBaseMainnetGames(platform) && prefersTestnetGames()) {
    return { ...platformWhere, isTestnet: true };
  }

  if (platform === "MINIPAY") {
    return { ...platformWhere, network: miniPayNetworks(options) };
  }

  return excludesTestnet(platform) ? { ...platformWhere, isTestnet: false } : platformWhere;
}

/** Prisma where fragment: scope a GameEntry query to a platform's games */
export function entryWhere(
  platform: UserPlatform,
  options?: GameVisibilityOptions,
): { game: Prisma.GameWhereInput } {
  return { game: gameWhere(platform, options) };
}
