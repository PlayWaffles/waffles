import { PostHog } from "posthog-node";

export function createPostHogClient(): PostHog {
  const token =
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_TOKEN or NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is required for PostHog server analytics",
    );
  }

  return new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

export async function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  const posthog = createPostHogClient();
  try {
    console.info("[posthog]", "server_capture", {
      event: params.event,
      distinctId: params.distinctId,
      properties: params.properties,
    });
    posthog.capture(params);
    await posthog.shutdown();
  } catch (error) {
    await posthog.shutdown().catch(() => {});
    throw error;
  }
}
