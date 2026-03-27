import type { UserPlatform } from "@prisma";

export const PLATFORM_COOKIE = "waffles_platform";
export const PLATFORM_HEADER = "x-waffles-platform";

// Hardcoded to avoid importing the Prisma enum value into the client bundle
const VALID_PLATFORMS = new Set<string>(["FARCASTER", "MINIPAY"]);

export function parsePlatform(
  value: string | null | undefined,
): UserPlatform | null {
  if (value && VALID_PLATFORMS.has(value)) {
    return value as UserPlatform;
  }

  return null;
}
