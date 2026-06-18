const DEFAULT_AVATARS = [
  "/images/player/avatar-fox.webp",
  "/images/player/avatar-bear.webp",
  "/images/player/avatar-frog.webp",
  "/images/player/avatar-panda.webp",
  "/images/player/avatar-owl.webp",
  "/images/player/avatar-cat.webp",
  "/images/player/avatar-dog.webp",
  "/images/player/avatar-rabbit.webp",
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
