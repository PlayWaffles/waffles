import type { UserPlatform } from "@prisma";

export const PLATFORM_COOKIE = "waffles_platform";
export const PLATFORM_HEADER = "x-waffles-platform";
export const MINIPAY_TESTNET_COOKIE = "waffles_minipay_testnet";

// Hardcoded to avoid importing the Prisma enum value into the client bundle
const VALID_PLATFORMS = new Set<string>(["FARCASTER", "MINIPAY", "BASE_APP"]);
const VALID_MINIPAY_TESTNET_VALUES = new Set<string>(["show", "hide"]);

export function parsePlatform(
  value: string | null | undefined,
): UserPlatform | null {
  if (value && VALID_PLATFORMS.has(value)) {
    return value as UserPlatform;
  }

  return null;
}

export function parseMiniPayTestnetPreference(
  value: string | null | undefined,
): boolean | null {
  if (!value || !VALID_MINIPAY_TESTNET_VALUES.has(value)) {
    return null;
  }

  return value === "show";
}
