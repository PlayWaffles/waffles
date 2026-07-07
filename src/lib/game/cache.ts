import { revalidatePath } from "next/cache";

export function revalidateGamePaths() {
  revalidatePath("/play");
}

export function safeRevalidateGamePaths(context: string) {
  try {
    revalidateGamePaths();
  } catch (error) {
    console.error("[game]", "revalidate_game_paths_error", {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}