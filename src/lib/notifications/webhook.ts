import { saveToken, deleteToken } from "./tokens";
import { sendToFid } from "./adapters/farcaster";
import { LOG_PREFIX } from "./constants";
import type { NotificationDetails, WebhookEventType } from "./types";

export interface WebhookEventData {
  fid: number;
  appFid: number;
  event: WebhookEventType;
  notificationDetails?: NotificationDetails;
}

/**
 * Handle webhook event - MUST be fast for Baseapp
 * Target response time: < 100ms
 *
 * Returns immediately after saving token.
 * Welcome notifications are sent asynchronously.
 */
export async function handleWebhookEvent(data: WebhookEventData): Promise<{
  success: boolean;
  shouldSendWelcome: boolean;
}> {
  const { fid, appFid, event, notificationDetails } = data;

  console.log(`${LOG_PREFIX} Webhook: ${event}, fid=${fid}, appFid=${appFid}`);

  switch (event) {
    case "miniapp_added":
      if (notificationDetails) {
        const saved = await saveToken(fid, appFid, notificationDetails);
        return { success: saved.success, shouldSendWelcome: saved.success };
      }
      return { success: true, shouldSendWelcome: false };

    case "notifications_enabled":
      if (notificationDetails) {
        const saved = await saveToken(fid, appFid, notificationDetails);
        return { success: saved.success, shouldSendWelcome: saved.success };
      }
      return { success: true, shouldSendWelcome: false };

    case "miniapp_removed":
    case "notifications_disabled":
      await deleteToken(fid, appFid);
      return { success: true, shouldSendWelcome: false };

    default:
      console.warn(`${LOG_PREFIX} Unknown event: ${event}`);
      return { success: true, shouldSendWelcome: false };
  }
}

/**
 * Send welcome notification (called AFTER webhook response)
 */
export async function sendWelcomeNotification(fid: number): Promise<void> {
  try {
    const { onboarding, buildPayload } = await import("./templates");
    const payload = buildPayload(onboarding.welcome());

    await sendToFid(fid, payload);
    console.log(`${LOG_PREFIX} Welcome sent: fid=${fid}`);
  } catch (error) {
    console.error(`${LOG_PREFIX} Welcome failed: fid=${fid}`, error);
  }
}
