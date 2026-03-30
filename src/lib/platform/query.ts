import type { UserPlatform } from "@prisma";
import type { Prisma } from "@prisma";

/** Prisma where fragment: scope a Game query to a platform */
export function gameWhere(platform: UserPlatform): Prisma.GameWhereInput {
  return { platform, isTestnet: false };
}

/** Prisma where fragment: scope a GameEntry query to a platform's games */
export function entryWhere(platform: UserPlatform): { game: Prisma.GameWhereInput } {
  return { game: { platform, isTestnet: false } };
}
