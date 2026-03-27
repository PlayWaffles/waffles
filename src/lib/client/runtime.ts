"use client";

import sdk from "@farcaster/miniapp-sdk";

import {
  PLATFORM_COOKIE,
  PLATFORM_HEADER,
} from "@/lib/platform/constants";
import type { UserPlatform } from "@prisma";

export type AppRuntime = "farcaster" | "minipay" | "browser";

let runtimePromise: Promise<AppRuntime> | null = null;

export function isMiniPayRuntime() {
  if (typeof window === "undefined") return false;

  return Boolean(
    (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum?.isMiniPay,
  );
}

export async function detectAppRuntime(): Promise<AppRuntime> {
  if (typeof window === "undefined") {
    return "browser";
  }

  if (isMiniPayRuntime()) {
    return "minipay";
  }

  try {
    return (await sdk.isInMiniApp()) ? "farcaster" : "browser";
  } catch {
    return "browser";
  }
}

export async function getAppRuntime(): Promise<AppRuntime> {
  runtimePromise ??= detectAppRuntime();
  return runtimePromise;
}

export function runtimeToPlatform(runtime: AppRuntime): UserPlatform {
  return runtime === "minipay" ? "MINIPAY" : "FARCASTER";
}

export function setRuntimePlatformCookie(platform: UserPlatform) {
  if (typeof document === "undefined") return false;

  const current = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PLATFORM_COOKIE}=`))
    ?.slice(PLATFORM_COOKIE.length + 1);

  if (current === platform) {
    return false;
  }

  document.cookie = `${PLATFORM_COOKIE}=${platform}; path=/; max-age=31536000; samesite=lax`;
  return true;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const runtime = await getAppRuntime();
  const platform = runtimeToPlatform(runtime);
  const headers = new Headers(init?.headers);
  headers.set(PLATFORM_HEADER, platform);

  if (runtime === "farcaster") {
    return sdk.quickAuth.fetch(input, {
      ...init,
      headers,
    });
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
