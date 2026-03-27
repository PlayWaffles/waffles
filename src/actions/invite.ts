"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";

import { validateReferralSchema } from "@/lib/schemas";

interface ValidationSuccess {
  valid: true;
  inviterId: string;
  inviteeId: string;
  code: string;
}

interface ValidationError {
  valid: false;
  error: string;
}

export type ValidateReferralResult = ValidationSuccess | ValidationError;

/**
 * Server Action: Validates an invite code and links the invitee to the inviter.
 * This is the core of the referral system.
 */
export async function redeemInviteCodeAction(
  _prevState: ValidateReferralResult | null,
  formData: FormData
): Promise<ValidateReferralResult> {
  const validation = validateReferralSchema.safeParse({
    code: formData.get("inviteCode"),
    userId: formData.get("userId"),
  });

  if (!validation.success) {
    const error = validation.error.issues[0]?.message ?? "Invalid input.";
    return { valid: false, error };
  }

  const { code, userId } = validation.data;

  try {
    const invitee = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, hasGameAccess: true, accessGrantedBy: true },
    });

    if (!invitee) {
      return {
        valid: false,
        error: "Your user account was not found.",
      };
    }

    // If user already has game access, return success (idempotent)
    if (invitee.hasGameAccess) {
      return {
        valid: true,
        inviterId: invitee.accessGrantedBy ?? "",
        inviteeId: invitee.id,
        code: code,
      };
    }

    // 2. Try user codes first
    const inviter = await prisma.user.findUnique({
      where: { inviteCode: code },
      select: { id: true, inviteQuota: true },
    });

    if (inviter) {
      // Check not self-inviting
      if (inviter.id === invitee.id) {
        return { valid: false, error: "You cannot invite yourself." };
      }

      // Check inviter has quota
      if (inviter.inviteQuota <= 0) {
        return { valid: false, error: "Inviter has no invites left." };
      }

      // Perform the activation in a transaction
      await prisma.$transaction(async (tx) => {
        // Decrement inviter's quota
        const quotaUpdate = await tx.user.updateMany({
          where: { id: inviter.id, inviteQuota: { gt: 0 } },
          data: { inviteQuota: { decrement: 1 } },
        });

        if (quotaUpdate.count === 0) {
          throw new Error("Inviter has no invites left.");
        }

        // Grant game access to invitee
        await tx.user.update({
          where: { id: invitee.id },
          data: {
            hasGameAccess: true,
            accessGrantedAt: new Date(),
            accessGrantedBy: inviter.id,
          },
        });

        // Log the reward event
        await tx.referralReward.upsert({
          where: { inviteeId: invitee.id },
          update: { inviterId: inviter.id, status: "PENDING" },
          create: {
            inviterId: inviter.id,
            inviteeId: invitee.id,
            status: "PENDING",
            amount: 0,
          },
        });
      });

      return {
        valid: true,
        inviterId: inviter.id,
        inviteeId: invitee.id,
        code,
      };
    }

    // 3. Try admin one-time codes
    const adminCode = await prisma.inviteCode.findFirst({
      where: { code, usedById: null },
      select: { id: true },
    });

    if (adminCode) {
      // Mark code as used and grant access in transaction
      await prisma.$transaction(async (tx) => {
        // Mark code used
        await tx.inviteCode.update({
          where: { id: adminCode.id },
          data: { usedById: invitee.id, usedAt: new Date() },
        });

        // Grant game access
        await tx.user.update({
          where: { id: invitee.id },
          data: {
            hasGameAccess: true,
            accessGrantedAt: new Date(),
            accessGrantedBy: null, // Admin code, no referrer
          },
        });
      });

      return {
        valid: true,
        inviterId: "", // No referrer for admin codes
        inviteeId: invitee.id,
        code,
      };
    }

    // 4. No valid code found
    return { valid: false, error: "Invalid code." };
  } catch (err) {
    console.error("[REDEEM_INVITE_CODE_ERROR]", err);
    return { valid: false, error: "Validation failed due to a server error." };
  }
}

/**
 * Server Action: Fetches the invite code for the logged-in user.
 * (Used on the /invite client page)
 */
