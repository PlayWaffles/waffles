"use server";

import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { logAdminAction, EntityType } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { sendBatch } from "@/lib/notifications";
import { env } from "@/lib/env";

// Validation schema - simplified: just title and body
const notificationSchema = z.object({
  title: z.string().min(1, "Title is required").max(65, "Title max 65 chars"),
  body: z.string().min(1, "Body is required").max(240, "Body max 240 chars"),
});

export type NotificationResult =
  | { success: true; total: number; sent: number; failed: number }
  | { success: false; error: string };

/**
 * Send admin notification to ALL users
 */
export async function sendAdminNotificationAction(
  _prevState: NotificationResult | null,
  formData: FormData,
): Promise<NotificationResult> {
  const authResult = await requireAdminSession();
  if (!authResult.authenticated || !authResult.session) {
    return { success: false, error: "Unauthorized" };
  }

  const rawData = {
    title: formData.get("title") as string,
    body: formData.get("body") as string,
  };

  const validation = notificationSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0].message };
  }

  const { title, body } = validation.data;

  const targetUrl = `${env.rootUrl}/game`;

  try {
    console.log("[AdminNotification] Sending to ALL:", { title, targetUrl });

    const users = await prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true },
    });
    const results = await sendBatch({ title, body, targetUrl }, users.map((u) => u.id));

    // Log admin action
    await logAdminAction({
      adminId: authResult.session.userId,
      action: "SEND_NOTIFICATION",
      entityType: EntityType.SYSTEM,
      details: {
        title,
        audience: "all",
        targetUrl,
        results: {
          total: results.total,
          success: results.success,
          failed: results.failed + results.invalidTokens + results.rateLimited,
        },
      },
    });

    revalidatePath("/admin/notifications");

    return {
      success: true,
      total: results.total,
      sent: results.success,
      failed: results.failed + results.invalidTokens + results.rateLimited,
    };
  } catch (error) {
    console.error("[AdminNotification] Error:", error);
    return { success: false, error: "Failed to send notifications" };
  }
}
