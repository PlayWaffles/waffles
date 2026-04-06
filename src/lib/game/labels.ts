export function formatGameLabel(gameNumber: number | null | undefined): string {
  return `Waffles #${String(gameNumber ?? 0).padStart(3, "0")}`;
}

export function formatAdminGameLabel(
  title: string | null | undefined,
  platform: string | null | undefined,
): string {
  const baseTitle = title?.trim() || "Untitled Game";
  if (!platform) return baseTitle;

  const platformLabel =
    platform === "MINIPAY"
      ? "MiniPay"
      : platform === "FARCASTER"
        ? "Farcaster"
        : platform === "BASE_APP"
          ? "Base App"
          : platform;

  return `${baseTitle} • ${platformLabel}`;
}
