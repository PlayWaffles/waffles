const MINIPAY_ADJECTIVES = [
  "golden",
  "crispy",
  "maple",
  "butter",
  "syrup",
  "lucky",
  "stacked",
  "swift",
  "bright",
  "brave",
  "sharp",
  "cosmic",
  "pixel",
  "turbo",
  "clever",
  "mighty",
] as const;

const MINIPAY_NOUNS = [
  "ace",
  "champ",
  "hero",
  "blitz",
  "winner",
  "titan",
  "maverick",
  "captain",
  "legend",
  "racer",
  "spark",
  "voyager",
  "wizard",
  "boss",
  "pro",
  "star",
] as const;

const MAX_USERNAME_ATTEMPTS = 100;

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function getMiniPayUsernameBase(seed: string) {
  const hash = hashString(seed.toLowerCase());
  const adjective = MINIPAY_ADJECTIVES[hash % MINIPAY_ADJECTIVES.length];
  const noun =
    MINIPAY_NOUNS[
      Math.floor(hash / MINIPAY_ADJECTIVES.length) % MINIPAY_NOUNS.length
    ];

  return `${adjective}_${noun}`;
}

export async function generateUniqueMiniPayUsername(
  seed: string,
  usernameExists: (username: string) => Promise<boolean>,
) {
  const hash = hashString(seed.toLowerCase());
  const base = getMiniPayUsernameBase(seed);

  if (!(await usernameExists(base))) {
    return base;
  }

  const firstSuffix = 10 + (hash % 90);

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const suffix = 10 + ((firstSuffix - 10 + attempt) % 90);
    const candidate = `${base}_${suffix}`;

    if (!(await usernameExists(candidate))) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique MiniPay username");
}
