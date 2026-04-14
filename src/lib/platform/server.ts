import { cookies } from "next/headers";
import { UserPlatform } from "@prisma";

import {
  MINIPAY_TESTNET_COOKIE,
  PLATFORM_COOKIE,
  PLATFORM_HEADER,
  parseMiniPayTestnetPreference,
  parsePlatform,
} from "@/lib/platform/constants";

export interface PlatformGameVisibility {
  includeTestnet?: boolean;
}

export function parseCookieHeader(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export async function resolveRuntimePlatform(
  request?: Request,
  fallback: UserPlatform = UserPlatform.BASE_APP,
): Promise<UserPlatform> {
  const headerPlatform = parsePlatform(request?.headers.get(PLATFORM_HEADER));
  if (headerPlatform) {
    return headerPlatform;
  }

  const requestCookiePlatform = parsePlatform(
    parseCookieHeader(request?.headers.get("cookie"), PLATFORM_COOKIE),
  );
  if (requestCookiePlatform) {
    return requestCookiePlatform;
  }

  if (!request) {
    const cookieStore = await cookies();
    const cookiePlatform = parsePlatform(cookieStore.get(PLATFORM_COOKIE)?.value);
    if (cookiePlatform) {
      return cookiePlatform;
    }
  }

  return fallback;
}

export async function resolvePlatformGameVisibility(
  platform: UserPlatform,
  request?: Request,
): Promise<PlatformGameVisibility> {
  if (platform !== UserPlatform.MINIPAY) {
    return {};
  }

  const requestCookieValue = parseMiniPayTestnetPreference(
    parseCookieHeader(request?.headers.get("cookie"), MINIPAY_TESTNET_COOKIE),
  );
  if (requestCookieValue !== null) {
    return { includeTestnet: requestCookieValue };
  }

  if (!request) {
    const cookieStore = await cookies();
    const cookieValue = parseMiniPayTestnetPreference(
      cookieStore.get(MINIPAY_TESTNET_COOKIE)?.value,
    );
    if (cookieValue !== null) {
      return { includeTestnet: cookieValue };
    }
  }

  return { includeTestnet: false };
}
