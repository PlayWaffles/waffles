"use client";

import sdk from "@farcaster/miniapp-sdk";

import { getAppRuntime } from "@/lib/client/runtime";

export async function shareTextOrCopy(data: {
  title?: string;
  text: string;
  url?: string;
}) {
  const runtime = await getAppRuntime();
  const normalizedUrl = data.url?.trim();

  if (runtime === "farcaster") {
    try {
      await sdk.actions.composeCast({
        text: data.text,
        embeds: normalizedUrl ? [normalizedUrl] : [],
      });
      return { shared: true, copied: false };
    } catch {
      return { shared: false, copied: false };
    }
  }

  if (runtime === "minipay" && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    const text = normalizedUrl ? `${data.text}\n${normalizedUrl}` : data.text;
    await navigator.clipboard.writeText(text);
    return { shared: false, copied: true };
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return { shared: true, copied: false };
    } catch {
      // Fall through to clipboard in plain browsers.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    const text = normalizedUrl ? `${data.text}\n${normalizedUrl}` : data.text;
    await navigator.clipboard.writeText(text);
    return { shared: false, copied: true };
  }

  return { shared: false, copied: false };
}
