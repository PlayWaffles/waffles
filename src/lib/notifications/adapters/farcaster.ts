import { z } from "zod";
import { prisma } from "@/lib/db";
import { deleteToken, deleteInvalidToken, getTokensForUser } from "../tokens";
import {
  FETCH_TIMEOUT_MS,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
  MAX_TOKENS_PER_REQUEST,
  BATCH_DELAY_MS,
  LOG_PREFIX,
} from "../constants";
import type {
  NotificationPayload,
  SendResult,
  BatchResult,
  TokenGroup,
  UserWithTokens,
} from "../types";
import type { PlatformNotifier } from "./types";

// Inline types from @farcaster/miniapp-node (not installed in MiniPay build)
interface SendNotificationRequest {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
  tokens: string[];
}

const sendNotificationResponseSchema = z.object({
  result: z.object({
    invalidTokens: z.array(z.string()),
    rateLimitedTokens: z.array(z.string()),
  }),
});

function getRetryDelay(attempt: number) {
  return Math.pow(2, attempt - 1) * RETRY_BASE_DELAY_MS;
}

// ---------------------------------------------------------------------------
// Single-user send (tries all tokens for a user's fid)
// ---------------------------------------------------------------------------

async function sendToFid(
  fid: number,
  payload: NotificationPayload,
): Promise<SendResult> {
  const tokens = await getTokensForUser(fid);
  if (tokens.length === 0) return { state: "no_token" };

  const notificationId = payload.notificationId ?? crypto.randomUUID();

  for (const token of tokens) {
    const result = await sendToToken({
      url: token.url,
      tokenString: token.token,
      appFid: token.appFid,
      fid,
      payload: { ...payload, notificationId },
    });

    if (result.state === "success") return result;

    if (result.state === "invalid_token") {
      await deleteToken(fid, token.appFid);
      continue;
    }
  }

  return { state: "error", error: "All tokens failed" };
}

async function sendToToken({
  url,
  tokenString,
  appFid,
  fid,
  payload,
}: {
  url: string;
  tokenString: string;
  appFid: number;
  fid: number;
  payload: NotificationPayload & { notificationId: string };
}): Promise<SendResult> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(attempt);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: payload.notificationId,
          title: payload.title,
          body: payload.body,
          targetUrl: payload.targetUrl,
          tokens: [tokenString],
        } satisfies SendNotificationRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status !== 200) {
        console.error(`${LOG_PREFIX} API error: status=${response.status}`, { fid });
        return { state: "error", error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      const parsed = sendNotificationResponseSchema.safeParse(data);
      if (!parsed.success) return { state: "error", error: parsed.error };

      const result = parsed.data.result;

      if (result.invalidTokens.includes(tokenString)) {
        console.log(`${LOG_PREFIX} Invalid token: fid=${fid}, appFid=${appFid}`);
        return { state: "invalid_token" };
      }

      if (result.rateLimitedTokens.includes(tokenString)) {
        if (attempt < MAX_RETRIES) continue;
        return { state: "rate_limit" };
      }

      return { state: "success" };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.error(`${LOG_PREFIX} Timeout: fid=${fid}`);
      }
      if (attempt === MAX_RETRIES) return { state: "error", error };
    }
  }

  return { state: "error", error: "Max retries exceeded" };
}

// ---------------------------------------------------------------------------
// Batch send
// ---------------------------------------------------------------------------

function groupTokensByUrl(users: UserWithTokens[]): TokenGroup[] {
  const map = new Map<string, TokenGroup["tokens"]>();

  for (const user of users) {
    for (const notif of user.notifs) {
      const existing = map.get(notif.url) ?? [];
      existing.push({
        token: notif.token,
        fid: user.fid,
        appFid: notif.appFid,
        userId: notif.id,
      });
      map.set(notif.url, existing);
    }
  }

  return Array.from(map.entries()).map(([url, tokens]) => ({ url, tokens }));
}

async function sendBatchToUrl(
  url: string,
  batch: TokenGroup["tokens"],
  payload: NotificationPayload & { notificationId: string },
): Promise<{ success: number; failed: number; invalidTokens: number; rateLimited: number }> {
  const result = { success: 0, failed: 0, invalidTokens: 0, rateLimited: 0 };
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, getRetryDelay(attempt)));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: payload.notificationId,
          title: payload.title,
          body: payload.body,
          targetUrl: payload.targetUrl,
          tokens: batch.map((t) => t.token),
        } satisfies SendNotificationRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      if (response.status !== 200) {
        const shouldRetry = response.status === 429 || response.status >= 500;
        if (shouldRetry && attempt < MAX_RETRIES) {
          console.warn(`${LOG_PREFIX} Batch request retrying after HTTP error`, {
            url,
            status: response.status,
            attempt: attempt + 1,
          });
          continue;
        }

        console.error(`${LOG_PREFIX} Batch request failed with HTTP error`, {
          url,
          status: response.status,
          body: responseText.slice(0, 300),
        });
        result.failed = batch.length;
        return result;
      }

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          console.warn(`${LOG_PREFIX} Batch request returned invalid JSON, retrying`, {
            url,
            attempt: attempt + 1,
          });
          continue;
        }
        console.error(`${LOG_PREFIX} Batch request returned invalid JSON`, {
          url,
          body: responseText.slice(0, 300),
          error,
        });
        result.failed = batch.length;
        return result;
      }

      const parsed = sendNotificationResponseSchema.safeParse(data);
      if (!parsed.success) {
        if (attempt < MAX_RETRIES) {
          console.warn(`${LOG_PREFIX} Batch response schema mismatch, retrying`, {
            url,
            attempt: attempt + 1,
          });
          continue;
        }
        console.error(`${LOG_PREFIX} Batch response schema mismatch`, {
          url,
          issues: parsed.error.issues,
        });
        result.failed = batch.length;
        return result;
      }

      const { invalidTokens, rateLimitedTokens } = parsed.data.result;
      result.success = batch.length - invalidTokens.length - rateLimitedTokens.length;
      result.invalidTokens = invalidTokens.length;
      result.rateLimited = rateLimitedTokens.length;

      for (const invalidToken of invalidTokens) {
        deleteInvalidToken(invalidToken).catch(() => {});
      }

      return result;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(`${LOG_PREFIX} Batch request threw, retrying`, {
          url,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
      console.error(`${LOG_PREFIX} Batch request failed:`, { url, error });
      result.failed = batch.length;
      return result;
    }
  }

  result.failed = batch.length;
  return result;
}

async function sendBatchToFids(
  payload: NotificationPayload,
  fids: number[],
): Promise<BatchResult> {
  const startTime = Date.now();

  if (fids.length === 0) {
    return { total: 0, success: 0, failed: 0, invalidTokens: 0, rateLimited: 0, durationMs: 0 };
  }

  const users: UserWithTokens[] = await prisma.user
    .findMany({
      where: { fid: { in: fids }, notifs: { some: {} } },
      select: {
        fid: true,
        username: true,
        notifs: { select: { id: true, appFid: true, token: true, url: true } },
      },
    })
    .then((rows) => rows.filter((u): u is UserWithTokens => u.fid !== null));

  if (users.length === 0) {
    return { total: 0, success: 0, failed: 0, invalidTokens: 0, rateLimited: 0, durationMs: Date.now() - startTime };
  }

  const tokenGroups = groupTokensByUrl(users);
  const results: BatchResult = {
    total: users.length,
    success: 0,
    failed: 0,
    invalidTokens: 0,
    rateLimited: 0,
    durationMs: 0,
  };

  const notificationId = payload.notificationId ?? `batch-${Date.now()}`;

  for (const group of tokenGroups) {
    for (let i = 0; i < group.tokens.length; i += MAX_TOKENS_PER_REQUEST) {
      const batch = group.tokens.slice(i, i + MAX_TOKENS_PER_REQUEST);
      const batchResult = await sendBatchToUrl(group.url, batch, { ...payload, notificationId });

      results.success += batchResult.success;
      results.failed += batchResult.failed;
      results.invalidTokens += batchResult.invalidTokens;
      results.rateLimited += batchResult.rateLimited;

      if (i + MAX_TOKENS_PER_REQUEST < group.tokens.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }
  }

  results.durationMs = Date.now() - startTime;
  return results;
}

// ---------------------------------------------------------------------------
// Adapter export
// ---------------------------------------------------------------------------

export const farcasterNotifier: PlatformNotifier = {
  async sendToUser(userId, payload) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fid: true },
    });
    if (!user?.fid) return { state: "no_token" };
    return sendToFid(user.fid, payload);
  },

  async sendBatch(payload, userIds) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { fid: true },
    });
    const fids = users.map((u) => u.fid).filter((f): f is number => f !== null);
    return sendBatchToFids(payload, fids);
  },
};

// Re-export for direct use by callers that already resolved fid/platform
export { sendToFid, sendBatchToFids };
