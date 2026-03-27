import { z } from "zod";

/**
 * Result of sending to a single user
 */
export type SendResult =
  | { state: "success" }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "invalid_token" }
  | { state: "error"; error: unknown };

/**
 * Result of batch send operation
 */
export interface BatchResult {
  total: number;
  success: number;
  failed: number;
  invalidTokens: number;
  rateLimited: number;
  durationMs: number;
}

/**
 * Notification payload
 */
export interface NotificationPayload {
  title: string;
  body: string;
  targetUrl: string;
  notificationId?: string; // For idempotency
}

/**
 * User with their notification tokens
 */
export interface UserWithTokens {
  fid: number;
  username: string | null;
  notifs: Array<{
    id: string;
    appFid: number;
    token: string;
    url: string;
  }>;
}

/**
 * Token grouped by URL for batch sending
 */
export interface TokenGroup {
  url: string;
  tokens: Array<{
    token: string;
    fid: number;
    appFid: number;
    userId: string;
  }>;
}

/**
 * Webhook event types (from Farcaster spec)
 */
export type WebhookEventType =
  | "miniapp_added"
  | "miniapp_removed"
  | "notifications_enabled"
  | "notifications_disabled";

/**
 * Notification details from webhook
 */
export interface NotificationDetails {
  url: string;
  token: string;
}

// Zod schema for validation
export const notificationPayloadSchema = z.object({
  title: z.string().min(1).max(32),
  body: z.string().min(1).max(128),
  targetUrl: z.string().url().max(1024),
  notificationId: z.string().max(128).optional(),
});
