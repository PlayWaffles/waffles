/**
 * Send a live in-app announcement to a single player over the realtime channel
 * (PartyKit/PartyServer). This is the "live toast" path: it pushes an
 * `announcement.delivered` message to the player's `user:<id>` room, so they see
 * the toast immediately IF they currently have the app open (it is not a stored
 * DB row / push notification — it only reaches connected sockets).
 *
 * Usage:
 *   node scripts/send-live-notification.mjs [username] [title] [body]
 * Defaults target `quickfalcon49` with a friendly hello.
 */
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  const envText = readFileSync(path, "utf8");
  for (const rawLine of envText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnvFile(".env");
process.env.AUTH_SECRET ||= "send-live-notification-local-process";
// Realtime delivery target. Falls back to the deployed Cloudflare worker if the
// PartyKit vars aren't in .env (they live in the deployment config, not local).
process.env.NEXT_PUBLIC_PARTYKIT_HOST ||=
  "https://waffles-party.ejioforcelestine77.workers.dev";
process.env.PARTYKIT_SECRET ||=
  "7f5f3efc079cafddc68fd643a1f98651857e42940b7a26a26efc600cca67ca65";

// `--global` delivers to the public `announcements` room (no per-user token
// needed — every connected client receives it). Used to diagnose whether the
// client is connected to PartyKit at all vs. only the per-user room failing.
const args = process.argv.slice(2).filter((a) => a !== "--global");
const isGlobal = process.argv.includes("--global");

const username = args[0] ?? "quickfalcon49";
const title = args[1] ?? "You're live on Waffles 🧇";
const body =
  args[2] ??
  "This is a live in-app notification — tap the bell anytime to catch up. Good luck in the next round!";

const { prisma } = await import("../src/lib/db.ts");
const { deliverAnnouncementToUsers, deliverGlobalAnnouncement } = await import(
  "../src/lib/realtime/announcementDelivery.ts"
);

const now = Date.now();
const announcement = {
  // `auto:` prefix marks this as an ephemeral, non-DB triggered card so client
  // persistence skips it (it's a live toast, not a stored inbox row).
  id: `auto:live-${now}`,
  priority: 90,
  tone: "maple",
  emoji: "🧇",
  title,
  body,
  surface: "toast",
  publishedAt: now,
  startsAt: now,
  endsAt: now + 60 * 60 * 1000,
  ephemeral: true,
};

if (isGlobal) {
  console.log("Delivering GLOBAL announcement to the public room (all connected clients)…");
  await deliverGlobalAnnouncement(announcement);
  console.log("Delivered globally. (Reaches every client currently connected to PartyKit.)");
  await prisma.$disconnect();
} else {
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  });

  if (!user) {
    console.error(`No user found with username "${username}".`);
    process.exit(1);
  }

  console.log(`Delivering live notification to ${user.username} (${user.id})…`);
  await deliverAnnouncementToUsers([user.id], announcement);
  console.log("Delivered. (Reaches the player only if their app is open.)");
  await prisma.$disconnect();
}
