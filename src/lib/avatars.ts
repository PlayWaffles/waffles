/**
 * Player avatar identities. New users are assigned a random one at account
 * creation (see `ensureUser` in auth.ts) so everyone gets a distinct pfp instead
 * of the default Waffles mascot. `avatarIdForSeed` gives a stable fallback for
 * any user without an assigned id (e.g. accounts created before this existed),
 * so no backfill is needed. The id → image map lives client-side in shared.tsx.
 */
export const AVATAR_IDS = [
  "fox",
  "bear",
  "frog",
  "panda",
  "owl",
  "cat",
  "dog",
  "rabbit",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATAR_IDS as readonly string[]).includes(value);
}

/** A random avatar id — used when a brand-new account is created. */
export function randomAvatarId(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)];
}

/** Deterministic avatar for a stable seed (userId / username), so a user with no
 *  assigned avatar still gets a consistent, non-default pfp. */
export function avatarIdForSeed(seed: string): AvatarId {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_IDS[h % AVATAR_IDS.length];
}
