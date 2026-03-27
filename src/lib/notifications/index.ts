// Types
export type {
  SendResult,
  BatchResult,
  NotificationPayload,
  WebhookEventType,
  NotificationDetails,
  UserWithTokens,
} from "./types";

// Token management
export {
  saveToken,
  deleteToken,
  getTokensForUser,
} from "./tokens";

// Sending
export { sendToUser } from "./send";
export { sendBatch } from "./batch";

// Platform adapters
export { getNotifier } from "./adapters";
export type { PlatformNotifier } from "./adapters";

// Webhook
export { handleWebhookEvent, sendWelcomeNotification } from "./webhook";

// Templates
export {
  preGame,
  liveGame,
  postGame,
  onboarding,
  transactional,
  retention,
  growth,
  buildPayload,
  type NotificationTemplate,
  type NotificationContext,
} from "./templates";

// Constants
export { LOG_PREFIX } from "./constants";
