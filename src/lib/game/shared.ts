import type { Prisma } from "@prisma";

/**
 * Unlock referral rewards when a user's first game entry is created.
 * Must be called inside a Prisma transaction.
 */
export async function unlockReferralRewards(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const entryCount = await tx.gameEntry.count({
    where: { userId },
  });

  if (entryCount === 1) {
    await tx.referralReward.updateMany({
      where: { inviteeId: userId, status: "PENDING" },
      data: { status: "UNLOCKED", unlockedAt: new Date() },
    });
  }
}
