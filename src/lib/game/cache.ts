import { revalidatePath } from "next/cache";

/**
 * Revalidate Next.js cache for game-related pages.
 */
export function revalidateGamePaths() {
  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");
}

/**
 * Cache invalidation should never make a successful mutation fail.
 */
export function safeRevalidateGamePaths(context: string) {
  try {
    revalidateGamePaths();
  } catch (error) {
    console.error("[game-actions]", "revalidate_game_paths_error", {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
