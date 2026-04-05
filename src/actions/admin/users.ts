"use server";

import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdminSession, hashPassword } from "@/lib/admin-auth";
import { logAdminAction, AdminAction, EntityType } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const userIdSchema = z.object({
  userId: z.string().min(1),
});

const adjustQuotaSchema = z.object({
  userId: z.string().min(1),
  quota: z.number().int().min(0),
});

export type UserActionResult =
  | { success: true; tempPassword?: string }
  | { success: false; error: string };

/**
 * Grant game access to a user
 */
export async function grantGameAccessAction(
  userId: string
): Promise<UserActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = userIdSchema.safeParse({ userId });
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    if (existingUser.hasGameAccess) {
      return { success: false, error: "User already has game access" };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        hasGameAccess: true,
        accessGrantedAt: new Date(),
        accessGrantedBy: authResult.session.userId,
      },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.UPDATE_USER_STATUS,
      entityType: EntityType.USER,
      entityId: userId,
      details: { action: "grant_access", username: user.username },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Grant game access error:", error);
    return { success: false, error: "Failed to grant game access" };
  }
}

/**
 * Ban a user
 */
export async function banUserAction(userId: string): Promise<UserActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = userIdSchema.safeParse({ userId });
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // Prevent self-ban
    if (userId === authResult.session.userId) {
      return { success: false, error: "You cannot ban yourself" };
    }

    if (existingUser.isBanned) {
      return { success: false, error: "User is already banned" };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedBy: authResult.session.userId,
      },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.BAN_USER,
      entityType: EntityType.USER,
      entityId: userId,
      details: { username: user.username },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Ban user error:", error);
    return { success: false, error: "Failed to ban user" };
  }
}

/**
 * Unban a user
 */
export async function unbanUserAction(
  userId: string
): Promise<UserActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = userIdSchema.safeParse({ userId });
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    if (!existingUser.isBanned) {
      return { success: false, error: "User is not banned" };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedBy: null,
      },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.UPDATE_USER_STATUS,
      entityType: EntityType.USER,
      entityId: userId,
      details: { action: "unban", username: user.username },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Unban user error:", error);
    return { success: false, error: "Failed to unban user" };
  }
}

/**
 * Adjust user's invite quota
 */
export async function adjustInviteQuotaAction(
  userId: string,
  quota: number
): Promise<UserActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = adjustQuotaSchema.safeParse({ userId, quota });
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { inviteQuota: quota },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.ADJUST_INVITE_QUOTA,
      entityType: EntityType.USER,
      entityId: userId,
      details: {
        oldQuota: existingUser.inviteQuota,
        newQuota: quota,
        username: user.username,
      },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Adjust quota error:", error);
    return { success: false, error: "Failed to adjust invite quota" };
  }
}

/**
 * Promote user to admin
 */
export async function promoteToAdminAction(
  userId: string
): Promise<UserActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = userIdSchema.safeParse({ userId });
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // Prevent self-promotion (already admin)
    if (existingUser.role === "ADMIN") {
      return { success: false, error: "User is already an admin" };
    }

    const tempPassword = randomBytes(12).toString("base64url");
    const hashedPassword = await hashPassword(tempPassword);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN", password: hashedPassword },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.PROMOTE_TO_ADMIN,
      entityType: EntityType.USER,
      entityId: userId,
      details: { username: user.username },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, tempPassword };
  } catch (error) {
    console.error("Promote to admin error:", error);
    return { success: false, error: "Failed to promote user" };
  }
}

/**
 * Revoke game access from a user
 */
export async function revokeGameAccessAction(
  userId: string
): Promise<UserActionResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const validation = userIdSchema.safeParse({ userId });
  if (!validation.success) {
    return { success: false, error: "Invalid input" };
  }

  try {
    // Check user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    if (!existingUser.hasGameAccess) {
      return { success: false, error: "User does not have game access" };
    }

    // Prevent revoking own access
    if (userId === authResult.session.userId) {
      return { success: false, error: "You cannot revoke your own access" };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        hasGameAccess: false,
        accessGrantedAt: null,
        accessGrantedBy: null,
      },
    });

    await logAdminAction({
      adminId: authResult.session.userId,
      action: AdminAction.UPDATE_USER_STATUS,
      entityType: EntityType.USER,
      entityId: userId,
      details: { action: "revoke_access", username: user.username },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true };
  } catch (error) {
    console.error("Revoke game access error:", error);
    return { success: false, error: "Failed to revoke game access" };
  }
}
