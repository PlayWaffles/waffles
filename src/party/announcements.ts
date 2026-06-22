import type * as Party from "partykit/server";
import type { AnnouncementRealtimeMessage } from "../lib/realtime/announcementMessages";

type TokenPayload = {
  sub: string;
  exp: number;
};

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64Url(signature);
}

async function verifyToken(token: string, secret: string): Promise<TokenPayload | null> {
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return null;

  const expected = await sign(payloadPart, secret);
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as TokenPayload;
    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function isMessage(value: unknown): value is AnnouncementRealtimeMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as { type?: unknown; announcement?: unknown; id?: unknown };
  if (message.type === "announcement.delivered") {
    return Boolean(message.announcement && typeof message.announcement === "object");
  }
  return message.type === "announcement.removed" && typeof message.id === "string";
}

export default class AnnouncementsParty implements Party.Server {
  constructor(readonly room: Party.Room) {}

  static async onBeforeConnect(request: Party.Request, lobby: Party.Lobby) {
    const room = new URL(request.url).pathname.split("/").pop() ?? "";
    if (!room.startsWith("user%3A") && !room.startsWith("user:")) return request;

    const token = new URL(request.url).searchParams.get("token");
    const secret = lobby.env.PARTYKIT_SECRET;
    if (typeof secret !== "string" || !token) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await verifyToken(token, secret);
    const expectedRoom = `user:${payload?.sub ?? ""}`;
    if (!payload || decodeURIComponent(room) !== expectedRoom) {
      return new Response("Unauthorized", { status: 401 });
    }

    return request;
  }

  async onRequest(request: Party.Request) {
    if (request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const expectedSecret = this.room.env.PARTYKIT_SECRET;
    const actualSecret = request.headers.get("x-waffles-party-secret");
    if (typeof expectedSecret !== "string" || actualSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const message = await request.json().catch(() => null);
    if (!isMessage(message)) {
      return new Response("Invalid announcement payload", { status: 400 });
    }

    this.room.broadcast(JSON.stringify(message));
    return Response.json({ delivered: true });
  }
}
