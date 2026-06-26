/**
 * Send a DURABLE in-app notification to a single player.
 *
 * Unlike scripts/send-live-notification.mjs (which only pushes a best-effort
 * realtime toast that requires the player's app to be connected to PartyKit RIGHT
 * NOW), this writes a persisted `Announcement(kind="notification")` row + an
 * `AnnouncementRecipient` link. `loadAnnouncements()` picks it up the next time
 * the player opens/refreshes the app and shows it in the bell inbox + home
 * banner — no live socket required. It ALSO fires the realtime toast as a bonus,
 * so a connected player sees it instantly too.
 *
 * Reads the DB from .env (the same DB staging uses). Usage:
 *   bun scripts/send-app-notification.mjs [username] [title] [body]
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
process.env.AUTH_SECRET ||= "send-app-notification-local-process";
process.env.NEXT_PUBLIC_PARTYKIT_HOST ||=
  "https://waffles-party.ejioforcelestine77.workers.dev";
process.env.PARTYKIT_SECRET ||=
  "7f5f3efc079cafddc68fd643a1f98651857e42940b7a26a26efc600cca67ca65";

const username = process.argv[2] ?? "quickfalcon49";
const title = process.argv[3] ?? "Welcome back to Waffles 🧇";
const body =
  process.argv[4] ??
  "Here's a little hello from the team — tap the bell anytime to catch up. Good luck in the next round!";

const { prisma } = await import("../src/lib/db.ts");
const { deliverAnnouncementToUsers } = await import(
  "../src/lib/realtime/announcementDelivery.ts"
);

const user = await prisma.user.findFirst({
  where: { username: { equals: username, mode: "insensitive" } },
  select: { id: true, username: true },
});

if (!user) {
  console.error(`No user found with username "${username}".`);
  process.exit(1);
}

const now = new Date();
const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // visible for 7 days

// Persist the notification + target it at this one user. `kind: "notification"`
// is the per-user feed channel (joined via AnnouncementRecipient in
// loadAnnouncements); it is excluded from the global authored feed.
const announcement = await prisma.announcement.create({
  data: {
    slug: `notif-${now.getTime()}`,
    title,
    body,
    kind: "notification",
    tone: "maple",
    emoji: "🧇",
    isActive: true,
    startsAt: now,
    endsAt,
    sortOrder: 100,
    recipients: { create: { userId: user.id } },
  },
  select: { id: true, slug: true },
});

console.log(
  `Persisted notification "${announcement.slug}" (${announcement.id}) for ${user.username} (${user.id}).`,
);
console.log("→ Appears in the bell inbox + home banner on the player's next app load/refresh.");

// Bonus: best-effort instant toast for a currently-connected client. Reuses the
// persisted id so the live card and the inbox card are the same announcement.
try {
  await deliverAnnouncementToUsers([user.id], {
    id: announcement.id,
    priority: 100,
    tone: "maple",
    emoji: "🧇",
    title,
    body,
    surface: "toast",
    publishedAt: now.getTime(),
    startsAt: now.getTime(),
    endsAt: endsAt.getTime(),
  });
  console.log("→ Also pushed a live toast (shows immediately if the app is connected).");
} catch (error) {
  console.warn("Live toast push failed (durable notification is still saved):", error?.message ?? error);
}

await prisma.$disconnect();
