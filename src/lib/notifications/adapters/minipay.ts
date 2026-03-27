import type { PlatformNotifier } from "./types";

/**
 * MiniPay has no push-notification channel yet.
 * This adapter logs and returns graceful no-ops.
 */
export const minipayNotifier: PlatformNotifier = {
  async sendToUser(_userId, payload) {
    console.info("[notifications:minipay] no notification channel", {
      title: payload.title,
    });
    return { state: "no_token" };
  },

  async sendBatch(payload, userIds) {
    console.info("[notifications:minipay] no notification channel (batch)", {
      title: payload.title,
      count: userIds.length,
    });
    return {
      total: userIds.length,
      success: 0,
      failed: 0,
      invalidTokens: 0,
      rateLimited: 0,
      durationMs: 0,
    };
  },
};
