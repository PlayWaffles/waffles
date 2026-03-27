import { cookies } from "next/headers";
import { UserPlatform } from "@prisma";

import {
  PLATFORM_COOKIE,
  PLATFORM_HEADER,
  parsePlatform,
} from "@/lib/platform/constants";

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
  fallback: UserPlatform = UserPlatform.FARCASTER,
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
