import { randomUUID } from "crypto";
import type { Prisma } from "@prisma";
import { prisma } from "@/lib/db";

type AnalyticsValue = string | number | boolean | null | undefined;
export type ServerAnalyticsProperties = Record<string, AnalyticsValue>;

const BLOCKED_PROPERTY_KEYS = new Set([
  "address",
  "wallet",
  "wallet_address",
  "signature",
  "tx_hash",
  "txHash",
  "transaction_hash",
  "email",
  "message",
  "support_message",
  "payment_identifier",
]);

function shortHash(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function hashServerAnalyticsId(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  return shortHash(String(value));
}

function sanitizeProperties(properties: ServerAnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => {
        if (BLOCKED_PROPERTY_KEYS.has(key)) return false;
        return (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null
        );
      })
      .slice(0, 50)
      .map(([key, value]) => [
        key,
        typeof value === "string" && value.length > 500 ? value.slice(0, 500) : value,
      ]),
  );
}

export async function trackServerEvent(params: {
  name: string;
  userId?: string | null;
  properties?: ServerAnalyticsProperties;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  const properties = {
    ...sanitizeProperties(params.properties),
    user_id_hash: hashServerAnalyticsId(params.userId),
  };

  try {
    await db.$executeRaw`
      INSERT INTO "AnalyticsEvent" ("id", "name", "userId", "source", "properties")
      VALUES (${randomUUID()}, ${params.name}, ${params.userId ?? null}, 'server', ${JSON.stringify(properties)}::jsonb)
    `;
  } catch (error) {
    console.error("[server-analytics]", params.name, error);
  }
}
