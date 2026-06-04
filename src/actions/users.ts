"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { syncUserSchema } from "@/lib/schemas";
import { Prisma, UserPlatform } from "@prisma";
import { generateInviteCode } from "@/lib/utils";
import { normalizeAddress, requireCurrentUser } from "@/lib/auth";
import { recoverRecentPurchasesForUser } from "@/lib/game/recovery";
import { sendToUser } from "@/lib/notifications";
import {
  attachWalletToFarcasterUser,
  resolveCanonicalFarcasterUser,
} from "@/lib/user-wallets";
import { generateUniqueMiniPayUsername } from "@/lib/usernames";

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

export type SyncFarcasterWalletResult =
  | { success: true; wallet: string; recovered: number }
  | { success: false; error: string };

export type UpdateMiniPayUsernameResult =
  | { success: true; username: string }
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
          username:
            platform === UserPlatform.MINIPAY
              ? username ?? existingUser.username
              : username,
          pfpUrl,
          fid: platform === "FARCASTER" ? fid ?? null : null,
          wallet: normalizedWallet,
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
      const initialUsername =
        platform === UserPlatform.MINIPAY && !username
          ? await generateUniqueMiniPayUsername(normalizedWallet!, (candidate) =>
              prisma.user
                .findFirst({
                  where: {
                    platform: UserPlatform.MINIPAY,
                    username: { equals: candidate, mode: "insensitive" },
                  },
                  select: { id: true },
                })
                .then(Boolean),
            )
          : username;

      for (let i = 0; i < MAX_RETRIES; i++) {
        try {
          user = await prisma.user.create({
            data: {
              platform,
              fid: platform === "FARCASTER" ? fid ?? undefined : undefined,
              username: initialUsername,
              pfpUrl,
              wallet: normalizedWallet ?? undefined,
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

export async function syncFarcasterWalletAndRecover(
  wallet: string,
): Promise<SyncFarcasterWalletResult> {
  try {
    const user = await requireCurrentUser();
    if (user.user.platform !== UserPlatform.FARCASTER) {
      return { success: false, error: "Only Farcaster users can use this sync" };
    }

    return syncFarcasterWalletAndRecoverForUser(user.user.id, wallet);
  } catch (err) {
    console.error("syncFarcasterWalletAndRecover Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Wallet sync failed",
    };
  }
}

export async function updateMiniPayUsernameAction(
  username: string,
): Promise<UpdateMiniPayUsernameResult> {
  const parsedUsername = z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only use letters, numbers, and underscores",
    )
    .safeParse(username);

  if (!parsedUsername.success) {
    return {
      success: false,
      error: parsedUsername.error.issues[0]?.message ?? "Invalid username",
    };
  }

  try {
    const { user } = await requireCurrentUser();

    if (user.platform !== UserPlatform.MINIPAY) {
      return { success: false, error: "Only MiniPay usernames can be edited here" };
    }

    const nextUsername = parsedUsername.data.toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: {
        id: { not: user.id },
        platform: UserPlatform.MINIPAY,
        username: { equals: nextUsername, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existingUser) {
      return { success: false, error: "That username is already taken" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { username: nextUsername },
    });

    revalidatePath("/game");
    revalidatePath("/profile");
    revalidatePath("/(app)/(game)", "layout");

    return { success: true, username: nextUsername };
  } catch (err) {
    console.error("updateMiniPayUsernameAction Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Username update failed",
    };
  }
}

export async function syncFarcasterWalletAndRecoverForUser(
  userId: string,
  wallet: string,
  username?: string | null,
): Promise<SyncFarcasterWalletResult> {
  const normalizedWallet = normalizeAddress(wallet);
  if (!normalizedWallet) {
    return { success: false, error: "Invalid wallet address" };
  }

  let canonicalUserId = userId;

  try {
    const canonicalUser = await prisma.$transaction(async (tx) => {
      const resolvedUser = await resolveCanonicalFarcasterUser(tx, userId, username);
      await attachWalletToFarcasterUser(tx, resolvedUser.id, normalizedWallet);
      return resolvedUser;
    });

    canonicalUserId = canonicalUser.id;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Wallet sync failed",
    };
  }

  const recovery = await recoverRecentPurchasesForUser({
    userId: canonicalUserId,
    platform: UserPlatform.FARCASTER,
    wallet: normalizedWallet,
  });

  if (recovery.recovered > 0) {
    void import("@/lib/notifications/templates").then(
      ({ transactional, buildPayload }) => {
        const payload = buildPayload(
          transactional.ticketRecovered(recovery.recovered),
        );
        sendToUser(canonicalUserId, payload).catch((error) =>
          console.error("syncFarcasterWalletAndRecover notification error:", error),
        );
      },
    );
  }

  revalidatePath("/game");
  revalidatePath("/(app)/(game)", "layout");

  return {
    success: true,
    wallet: normalizedWallet,
    recovered: recovery.recovered,
  };
}
