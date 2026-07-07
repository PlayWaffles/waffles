import { getCurrentUser } from "@/lib/auth";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

type Handler<Args extends unknown[], T> = (
  user: CurrentUser,
  ...args: Args
) => Promise<T>;

/** Reads that return null when unauthenticated (e.g. `/v2` preview outside miniapp). */
export function withPlayerRead<Args extends unknown[], T>(
  handler: Handler<Args, T>,
): (...args: Args) => Promise<T | null> {
  return async (...args: Args) => {
    const user = await getCurrentUser();
    if (!user) return null;
    return handler(user, ...args);
  };
}

/** Reads that return an empty list when unauthenticated. */
export function withPlayerReadList<Args extends unknown[], T>(
  handler: Handler<Args, T[]>,
): (...args: Args) => Promise<T[]> {
  return async (...args: Args) => {
    const user = await getCurrentUser();
    if (!user) return [];
    return handler(user, ...args);
  };
}

/** Mutations that no-op when unauthenticated. */
export function withPlayerMutation<Args extends unknown[]>(
  handler: Handler<Args, void>,
): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    const user = await getCurrentUser();
    if (!user) return;
    await handler(user, ...args);
  };
}

/** Handlers that accept an optional user (guest-safe reads). */
export function withOptionalPlayer<Args extends unknown[], T>(
  handler: (user: CurrentUser | null, ...args: Args) => Promise<T>,
): (...args: Args) => Promise<T> {
  return async (...args: Args) => {
    const user = await getCurrentUser();
    return handler(user, ...args);
  };
}

/** Reads that return a fixed fallback when unauthenticated. */
export function withPlayerReadOr<Args extends unknown[], T>(
  handler: Handler<Args, T>,
  fallback: T,
): (...args: Args) => Promise<T> {
  return async (...args: Args) => {
    const user = await getCurrentUser();
    if (!user) return fallback;
    return handler(user, ...args);
  };
}