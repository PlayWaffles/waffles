/**
 * Sends in-app (live toast) versions of the TOURNAMENT-lifecycle notifications —
 * mirrors the real copy in src/lib/notifications/templates.ts (preGame / liveGame
 * / postGame), routed to the right in-app screens. Spaced ~5s apart.
 *
 * Usage: bun scripts/send-tournament-notifications.mjs [username]
 */
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

loadEnvFile(".env");
process.env.AUTH_SECRET ||= "send-tournament-notifications-local-process";
process.env.NEXT_PUBLIC_PARTYKIT_HOST ||= "https://waffles-party.ejioforcelestine77.workers.dev";
process.env.PARTYKIT_SECRET ||= "7f5f3efc079cafddc68fd643a1f98651857e42940b7a26a26efc600cca67ca65";

const username = process.argv[2] ?? "quickfalcon49";

const { prisma } = await import("../src/lib/db.ts");
const { deliverAnnouncementToUsers } = await import("../src/lib/realtime/announcementDelivery.ts");
// Pull the REAL MiniPay copy from the shared templates so this demo shows exactly
// what the app sends. `MP` is the MINIPAY platform arg the templates branch on.
const { preGame, liveGame, postGame } = await import("../src/lib/notifications/templates.ts");
const MP = "MINIPAY";

const user = await prisma.user.findFirst({
  where: { username: { equals: username, mode: "insensitive" } },
  select: { id: true, username: true },
});
if (!user) {
  console.error(`No user found with username "${username}".`);
  process.exit(1);
}

const now = Date.now();
const base = { publishedAt: now, startsAt: now, endsAt: now + 60 * 60 * 1000 };
const meta = { title: "World Cup Bowl #10", category: "Football", prizePool: 1 };

// Tournament lifecycle, rendered from the real templates.ts MiniPay variants
// (platform = MINIPAY): open → filling → boosted → starting → flipped → settled
// → won → claimed. Presentation (tone/emoji/cta/surface) is added per event.
const examples = [
  { label: "gameOpen", id: "auto:tour-open", priority: 70, tone: "maple", emoji: "🎟️",
    ...preGame.gameOpen(10, 8, 1, meta, MP), cta: { label: "Join the round", screen: "home" }, ...base },
  { label: "almostSoldOut", id: "auto:tour-almost", priority: 75, tone: "leaf", emoji: "🔥",
    ...preGame.almostSoldOut(10, 8, MP), cta: { label: "Grab a spot", screen: "home" }, ...base },
  { label: "prizePoolBoost", id: "auto:tour-boost", priority: 80, tone: "maple", emoji: "💰",
    ...preGame.prizePoolBoost(10, "0.50", "1.00", MP), cta: { label: "See the pool", screen: "home" }, ...base },
  { label: "countdown5min", id: "auto:tour-5min", priority: 85, tone: "leaf", emoji: "⏰",
    ...preGame.countdown5min(10, undefined, MP), cta: { label: "Get ready", screen: "home" }, ...base },
  { label: "flipped", id: "auto:tour-flipped", priority: 90, tone: "berry", emoji: "⚡",
    ...liveGame.flipped(10, "SwiftFalcon23", MP), cta: { label: "See standings", screen: "leaderboard" }, ...base },
  { label: "results", id: "auto:tour-results", priority: 80, tone: "leaf", emoji: "🎯",
    ...postGame.results(10, meta, MP), cta: { label: "See your result", screen: "results" }, ...base },
  { label: "winner", id: "auto:tour-winner", priority: 100, tone: "maple", emoji: "🥇",
    ...postGame.winner(10, 1, "0.40", meta, MP), cta: { label: "Claim your prize", screen: "profile" }, ...base },
  { label: "claimed", id: "auto:tour-claimed", priority: 60, tone: "leaf", emoji: "✅",
    ...postGame.claimed("0.40", MP), surface: "toast", ...base },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Sending ${examples.length} tournament notifications to ${user.username} (${user.id}), ~5s apart:\n`);
for (let i = 0; i < examples.length; i++) {
  const { label, ...announcement } = examples[i];
  await deliverAnnouncementToUsers([user.id], announcement);
  console.log(`  ${i + 1}/${examples.length}  ${label}`);
  if (i < examples.length - 1) await wait(5000);
}
console.log("\nDone. Each should have appeared as a top toast in order.");

await prisma.$disconnect();
