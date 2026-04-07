import { PostHog } from "posthog-node";

export function createPostHogClient(): PostHog {
  return new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN!,
    {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    },
  );
}

export async function captureServerEvent(params: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) {
  const posthog = createPostHogClient();
  try {
    posthog.capture(params);
    await posthog.shutdown();
  } catch (error) {
    await posthog.shutdown().catch(() => {});
    throw error;
  }
}
