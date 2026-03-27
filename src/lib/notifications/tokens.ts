import { prisma } from "@/lib/db";
import { LOG_PREFIX } from "./constants";
import type { NotificationDetails } from "./types";

/**
 * Save notification token (MUST be fast for webhook response)
 * Target: < 50ms
 */
export async function saveToken(
  fid: number,
  appFid: number,
  details: NotificationDetails
): Promise<{ success: boolean; userId?: string }> {
  const start = Date.now();

  try {
    const user = await prisma.user.findUnique({
      where: { fid },
      select: { id: true },
    });

    if (!user) {
      console.warn(`${LOG_PREFIX} User not found: fid=${fid}`);
      return { success: false };
    }

    await prisma.notificationToken.upsert({
      where: { userId_appFid: { userId: user.id, appFid } },
      update: {
        token: details.token,
        url: details.url,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        appFid,
        token: details.token,
        url: details.url,
      },
    });

    const duration = Date.now() - start;
    console.log(
      `${LOG_PREFIX} Token saved: fid=${fid}, appFid=${appFid} (${duration}ms)`
    );

    return { success: true, userId: user.id };
  } catch (error) {
    console.error(`${LOG_PREFIX} Save token failed:`, { fid, appFid, error });
    return { success: false };
  }
}

/**
 * Delete notification token
 */
export async function deleteToken(
  fid: number,
  appFid: number
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { fid },
      select: { id: true },
    });

    if (!user) return false;

    await prisma.notificationToken.deleteMany({
      where: { userId: user.id, appFid },
    });

    console.log(`${LOG_PREFIX} Token deleted: fid=${fid}, appFid=${appFid}`);
    return true;
  } catch (error) {
    console.error(`${LOG_PREFIX} Delete token failed:`, { fid, appFid, error });
    return false;
  }
}

/**
 * Delete invalid token by token string (used during batch send)
 */
export async function deleteInvalidToken(tokenString: string): Promise<void> {
  try {
    await prisma.notificationToken.deleteMany({
      where: { token: tokenString },
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to delete invalid token`, error);
  }
}

/**
 * Get all tokens for a user
 */
export async function getTokensForUser(fid: number) {
  const user = await prisma.user.findUnique({
    where: { fid },
    select: {
      notifs: {
        select: { id: true, appFid: true, token: true, url: true },
      },
    },
  });
  return user?.notifs ?? [];
}

