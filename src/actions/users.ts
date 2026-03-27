"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { syncUserSchema } from "@/lib/schemas";
import { Prisma, UserPlatform } from "@prisma";
import { generateInviteCode } from "@/lib/utils";
import { normalizeAddress } from "@/lib/auth";

const MAX_RETRIES = 10;

// --- Types ---
type SyncedUser = {
  platform: UserPlatform;
  fid: number | null;
  username: string | null;
  pfpUrl: string | null;
  wallet: string | null;
  inviteCode: string;
};

export type SyncUserResult =
  | { success: true; user: SyncedUser }
  | { success: false; error: string };

/**
 * Creates a new user or updates an existing user's profile.
 */
export async function upsertUser(
  input: z.input<typeof syncUserSchema>
): Promise<SyncUserResult> {
  const validation = syncUserSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.message || "Invalid input",
    };
  }

  const { platform, fid, username, pfpUrl, wallet } = validation.data;
  const normalizedWallet = wallet ? normalizeAddress(wallet) : null;

  try {
    const existingUser =
      platform === "FARCASTER"
        ? await prisma.user.findUnique({
            where: { fid: fid! },
          })
        : await prisma.user.findUnique({
            where: { wallet: normalizedWallet! },
          });

    let user: SyncedUser;

    if (existingUser) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          platform,
          username,
          pfpUrl,
          fid: platform === "FARCASTER" ? fid ?? null : null,
          wallet: platform === "MINIPAY" ? normalizedWallet : null,
        },
        select: {
          platform: true,
          fid: true,
          username: true,
          pfpUrl: true,
          wallet: true,
          inviteCode: true,
        },
      });
    } else {
      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          user = await prisma.user.create({
            data: {
              platform,
              fid: platform === "FARCASTER" ? fid ?? undefined : undefined,
              username,
              pfpUrl,
              wallet: platform === "MINIPAY" ? normalizedWallet ?? undefined : undefined,
              inviteCode: generateInviteCode(),
            } as Prisma.UserCreateInput,
            select: {
              platform: true,
              fid: true,
              username: true,
              pfpUrl: true,
              wallet: true,
              inviteCode: true,
            },
          });
          break;
        } catch (err) {
          // Retry on invite code collision
          const isCodeCollision =
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002" &&
            Array.isArray(err.meta?.target) &&
            err.meta.target.includes("inviteCode");

          if (!isCodeCollision || i === MAX_RETRIES - 1) throw err;
        }
      }
    }

    revalidatePath("/game");
    return { success: true, user: user! };
  } catch (err) {
    console.error("syncUserAction Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "User sync failed",
    };
  }
}
