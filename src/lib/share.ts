"use client";

export async function shareTextOrCopy(data: {
  title?: string;
  text: string;
  url?: string;
}) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return { shared: true, copied: false };
    } catch {
      // Fall through to clipboard.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    const text = data.url ? `${data.text}\n${data.url}` : data.text;
    await navigator.clipboard.writeText(text);
    return { shared: false, copied: true };
  }

  return { shared: false, copied: false };
}
