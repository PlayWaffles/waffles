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

export async function POST(request: NextRequest) {
  const requestJson = await request.text();

  console.log("[Webhook] Received POST /api/webhook/notify", {
    contentLength: requestJson.length,
  });

  let data: Awaited<ReturnType<typeof parseWebhookEvent>>;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;
    console.error("[Webhook] Verification failed:", error.name, error.message);
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

  if (result.shouldSendWelcome) {
    sendWelcomeNotification(fid).catch(console.error);
  }

  return NextResponse.json({ success: result.success });
}
