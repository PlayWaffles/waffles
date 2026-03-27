/**
 * Live Game Notifications
 *
 * Handles notifications during live gameplay, like "got flipped" on leaderboard.
 */

import { prisma } from "@/lib/db";
import { sendToUser } from "@/lib/notifications";
import { liveGame, buildPayload } from "@/lib/notifications/templates";

const TOP_N = 10; // Only track top 10 positions

/**
 * Check if any players got flipped and notify them.
 * Should be called after a player's score is updated.
 *
 * @param gameId - The game ID
 * @param gameNumber - Game number for notification template
 * @param scoringUserId - The user who just scored (who might have flipped others)
 * @param scoringUsername - Username of the scoring player
 * @param newScore - The new score of the scoring player
 */
export async function checkAndNotifyFlipped(
  gameId: string,
  gameNumber: number,
  scoringUserId: string,
  scoringUsername: string,
  newScore: number,
): Promise<void> {
  try {
    // Get current top 10 leaderboard after the score update
    const leaderboard = await prisma.gameEntry.findMany({
      where: { gameId },
      orderBy: [{ score: "desc" }, { updatedAt: "asc" }],
      take: TOP_N + 5, // Get a few extra to detect who fell out
      select: {
        userId: true,
        score: true,
        user: { select: { fid: true, username: true } },
      },
    });

    // Find the scoring player's new position
    const scorerPosition = leaderboard.findIndex(
      (e) => e.userId === scoringUserId,
    );

    // If scorer is not in top 10, no one was flipped
    if (scorerPosition < 0 || scorerPosition >= TOP_N) {
      return;
    }

    // Find players who got pushed down (they're now just below the scorer)
    // These are players who were at positions [scorerPosition..TOP_N-1]
    // and are now at [scorerPosition+1..TOP_N]
    // Only notify the ONE player who got pushed out of their position by the scorer

    // Simple heuristic: notify the player at position scorerPosition+1
    // if they have a lower score than the scorer
    const pushedPlayer = leaderboard[scorerPosition + 1];

    if (
      pushedPlayer &&
      pushedPlayer.userId !== scoringUserId &&
      pushedPlayer.score < newScore
    ) {
      // Only notify if this player was in top N before and now got pushed
      const pushPosition = scorerPosition + 1;

      // Check if this pushed them out of top 10
      if (pushPosition >= TOP_N) {
        // They got pushed out of top 10 entirely - definitely notify
        const template = liveGame.flipped(gameNumber, scoringUsername);
        const payload = buildPayload(template, gameId, "pregame"); // Links to game lobby

        await sendToUser(pushedPlayer.userId, payload);

        console.log("[LiveNotify] Sent flip notification", {
          gameId,
          pushedUser: pushedPlayer.user.username,
          byUser: scoringUsername,
        });
      }
      // If they're still in top 10 but just shifted, don't spam them
    }
  } catch (error) {
    // Log but don't throw - notifications shouldn't break gameplay
    console.error("[LiveNotify] Flip check error:", error);
  }
}
