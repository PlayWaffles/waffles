const DEFAULT_AVATARS = [
  "/images/v2/avatar-fox.webp",
  "/images/v2/avatar-bear.webp",
  "/images/v2/avatar-frog.webp",
  "/images/v2/avatar-panda.webp",
  "/images/v2/avatar-owl.webp",
  "/images/v2/avatar-cat.webp",
  "/images/v2/avatar-dog.webp",
  "/images/v2/avatar-rabbit.webp",
];

export function getDefaultAvatarUrl(seed: string | null | undefined) {
  const value = seed?.trim() || "player";
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

export function getPlayerAvatarUrl(input: {
  pfpUrl?: string | null;
  username?: string | null;
}) {
  return input.pfpUrl || getDefaultAvatarUrl(input.username);
}
