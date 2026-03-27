import type { NotificationPayload, SendResult, BatchResult } from "../types";

/** Platform-specific notification sender */
export interface PlatformNotifier {
  /** Send a notification to a single user by their universal userId */
  sendToUser(userId: string, payload: NotificationPayload): Promise<SendResult>;

  /** Send a batch notification to a set of userIds */
  sendBatch(payload: NotificationPayload, userIds: string[]): Promise<BatchResult>;
}
