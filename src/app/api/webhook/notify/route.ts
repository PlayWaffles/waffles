import { NextResponse, type NextRequest } from "next/server";
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
  type ParseWebhookEvent,
} from "@farcaster/miniapp-node";

import {
  handleWebhookEvent,
  sendWelcomeNotification,
} from "@/lib/notifications/webhook";
import { trackServerEvent } from "@/lib/server-analytics";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let requestData: unknown = rawBody;

  try {
    requestData = JSON.parse(rawBody);
  } catch {
    // Keep raw text as a fallback for non-JSON payloads.
  }

  console.log("[Webhook] Received POST /api/webhook/notify", {
    contentLength: rawBody.length,
    contentType: request.headers.get("content-type"),
    parsedAsJson: typeof requestData === "object" && requestData !== null,
  });
  await trackServerEvent({
    name: "notification_webhook_received",
    properties: {
      event_type: typeof requestData === "object" && requestData !== null && "event" in requestData ? "present" : null,
      has_notification_details:
        typeof requestData === "object" &&
        requestData !== null &&
        JSON.stringify(requestData).includes("notificationDetails"),
      content_length: rawBody.length,
    },
  });

  let data: Awaited<ReturnType<typeof parseWebhookEvent>>;
  try {
    data = await parseWebhookEvent(requestData, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;
    console.error("[Webhook] Verification failed:", error.name, error.message);
    await trackServerEvent({
      name: "notification_webhook_rejected",
      properties: {
        event_type: null,
        has_notification_details: false,
        success: false,
        reason: error.name,
      },
    });
    return NextResponse.json(
      { success: false, error: error.name },
      { status: 400 },
    );
  }

  const { fid, appFid, event } = data;
  const hasNotifDetails = "notificationDetails" in event;

  console.log("[Webhook] Verified event:", {
    fid,
    appFid,
    event: event.event,
    hasNotificationDetails: hasNotifDetails,
  });
  await trackServerEvent({
    name: "notification_webhook_verified",
    properties: {
      event_type: event.event,
      has_notification_details: hasNotifDetails,
      success: true,
    },
  });

  const result = await handleWebhookEvent({
    fid,
    appFid,
    event: event.event,
    notificationDetails: hasNotifDetails ? event.notificationDetails : undefined,
  });

  console.log("[Webhook] Handler result:", {
    fid,
    event: event.event,
    success: result.success,
    shouldSendWelcome: result.shouldSendWelcome,
  });
  await trackServerEvent({
    name: "notification_handler_succeeded",
    properties: {
      event_type: event.event,
      has_notification_details: hasNotifDetails,
      success: result.success,
      should_send_welcome: result.shouldSendWelcome,
    },
  });

  if (result.shouldSendWelcome) {
    sendWelcomeNotification(fid)
      .then(() =>
        trackServerEvent({
          name: "notification_welcome_sent",
          properties: {
            event_type: event.event,
            success: true,
          },
        }),
      )
      .catch((error) => {
        console.error(error);
        void trackServerEvent({
          name: "notification_welcome_failed",
          properties: {
            event_type: event.event,
            success: false,
            reason: error instanceof Error ? error.message : "welcome_failed",
          },
        });
      });
  }

  return NextResponse.json({ success: result.success });
}
