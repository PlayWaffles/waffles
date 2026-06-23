/**
 * Realtime announcements server — Cloudflare Worker + Durable Object, built on
 * PartyServer (the maintained successor to PartyKit). It deploys with Wrangler
 * straight to our own Cloudflare account, so there is no dependency on the
 * (now-defunct) partykit.dev hosted platform.
 *
 * Routing: PartyServer maps the URL party segment to a Durable Object binding by
 * kebab-casing the binding name. The binding is named `Main` in wrangler.jsonc,
 * which resolves the party "main" the client (`PartySocket({ party: "main" })`)
 * and the server-side delivery layer (`/parties/main/<room>`) already use — so
 * the rest of the app is unchanged; only NEXT_PUBLIC_PARTYKIT_HOST moves to the
 * new Cloudflare host.
 *
 * This is a straight port of the old PartyKit `announcements.ts`: same token
 * scheme, same secret-gated HTTP delivery, same message shape.
 */
import { Server, routePartykitRequest } from "partyserver";

// Minimal structural mirror of `AnnouncementRealtimeMessage`
// (src/lib/realtime/announcementMessages.ts). Kept local so this Worker stays
// fully self-contained — it only validates the envelope and rebroadcasts the
// raw JSON, never inspecting the announcement payload, so it doesn't need the
// app's Prisma-bound types.
type RealtimeMessage =
  | { type: "announcement.delivered"; announcement: unknown }
  | { type: "announcement.removed"; id: string };

interface Env {
  Main: DurableObjectNamespace<AnnouncementsServer>;
  PARTYKIT_SECRET: string;
}

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

function isMessage(value: unknown): value is RealtimeMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as { type?: unknown; announcement?: unknown; id?: unknown };
  if (message.type === "announcement.delivered") {
    return Boolean(message.announcement && typeof message.announcement === "object");
  }
  return message.type === "announcement.removed" && typeof message.id === "string";
}

export class AnnouncementsServer extends Server<Env> {
  // Server-to-server delivery: the Next app POSTs a realtime message here with
  // the shared secret; we fan it out to every socket in this room.
  async onRequest(request: Request) {
    if (request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    const expectedSecret = this.env.PARTYKIT_SECRET;
    const actualSecret = request.headers.get("x-waffles-party-secret");
    if (typeof expectedSecret !== "string" || actualSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const message = await request.json().catch(() => null);
    if (!isMessage(message)) {
      return new Response("Invalid announcement payload", { status: 400 });
    }

    this.broadcast(JSON.stringify(message));
    return Response.json({ delivered: true });
  }
}

// Gate per-user rooms (`user:<id>`) behind the signed token the client sends as
// `?token=`. The global `announcements` room is a public read-only fan-out.
async function authorizeConnection(request: Request, env: Env): Promise<Response | undefined> {
  const room = new URL(request.url).pathname.split("/").pop() ?? "";
  if (!room.startsWith("user%3A") && !room.startsWith("user:")) return; // global room — allow

  const token = new URL(request.url).searchParams.get("token");
  const secret = env.PARTYKIT_SECRET;
  if (typeof secret !== "string" || !token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await verifyToken(token, secret);
  const expectedRoom = `user:${payload?.sub ?? ""}`;
  if (!payload || decodeURIComponent(room) !== expectedRoom) {
    return new Response("Unauthorized", { status: 401 });
  }
  return; // authorized
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env, {
        cors: true,
        onBeforeConnect: (req) => authorizeConnection(req, env),
      })) ?? new Response("Not found", { status: 404 })
    );
  },
};

export default handler;
