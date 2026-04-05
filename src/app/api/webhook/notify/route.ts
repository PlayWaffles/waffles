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

  let data: Awaited<ReturnType<typeof parseWebhookEvent>>;
  try {
    data = await parseWebhookEvent(requestJson, verifyAppKeyWithNeynar);
  } catch (e: unknown) {
    const error = e as ParseWebhookEvent.ErrorType;
    console.error("[Webhook] Verification failed:", error.name);
    return NextResponse.json(
      { success: false, error: error.name },
      { status: 400 },
    );
  }

  const { fid, appFid, event } = data;

  const result = await handleWebhookEvent({
    fid,
    appFid,
    event: event.event,
    notificationDetails:
      "notificationDetails" in event ? event.notificationDetails : undefined,
  });

  // Send welcome notification after responding (don't block)
  if (result.shouldSendWelcome) {
    sendWelcomeNotification(fid).catch(console.error);
  }

  return NextResponse.json({ success: result.success });
}
