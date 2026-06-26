/**
 * Sends one of EACH in-app notification style as a live toast to a player, spaced
 * out so each is visible before the next replaces it. Mirrors the real shapes the
 * app produces (see src/lib/player/announcements.ts + announcements/registry):
 * the two triggered cards (prize-to-claim, near-miss), plus authored variants
 * covering every tone and tap-surface (toast / small modal / full takeover).
 *
 * Usage: bun scripts/send-notification-examples.mjs [username]
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
process.env.AUTH_SECRET ||= "send-notification-examples-local-process";
process.env.NEXT_PUBLIC_PARTYKIT_HOST ||= "https://waffles-party.ejioforcelestine77.workers.dev";
process.env.PARTYKIT_SECRET ||= "7f5f3efc079cafddc68fd643a1f98651857e42940b7a26a26efc600cca67ca65";

const username = process.argv[2] ?? "quickfalcon49";

const { prisma } = await import("../src/lib/db.ts");
const { deliverAnnouncementToUsers } = await import("../src/lib/realtime/announcementDelivery.ts");

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

// label = what to look for; the rest is the real PlayerAnnouncement payload.
// Covers every notification TYPE: the toast variants (info / screen-CTA /
// sheet-CTA / theme-CTA) AND the two modal surfaces (small bottom-sheet, full
// takeover). A live delivery always arrives as a top toast; `surface` + `cta`
// decide what tapping it does.
const examples = [
  {
    label: "Toast · prize to claim (maple · CTA → Prize Wallet screen)",
    id: "auto:prize-unclaimed", priority: 100, tone: "maple", emoji: "💰",
    title: "You have a prize to claim",
    body: "1.20 USDT is waiting in your Prize Wallet. Claim it before it slips your mind.",
    cta: { label: "Open Prize Wallet", screen: "profile" }, ...base,
  },
  {
    label: "Toast · near-miss result (leaf · CTA → tournament results screen)",
    id: "auto:result-near-miss", priority: 80, tone: "leaf", emoji: "🎯",
    title: "You finished #14 — so close",
    body: "The prize bracket was just ahead. See exactly where you landed and jump back in.",
    cta: { label: "See your result", screen: "results" }, ...base,
  },
  {
    label: "Toast · plain info (berry · no CTA — just dismisses on tap)",
    id: "auto:info", priority: 60, tone: "berry", emoji: "📣",
    title: "New questions just dropped",
    body: "Fresh trivia across every category is live. Jump into a round and try them out.",
    surface: "toast", ...base,
  },
  {
    label: "Toast · daily reward (maple · CTA → opens the daily streak sheet)",
    id: "auto:daily", priority: 70, tone: "maple", emoji: "🎁",
    title: "Daily reward is ready",
    body: "Your streak bonus is waiting. Tap to open it and keep the run alive — miss a day and the multiplier resets.",
    cta: { label: "Open daily reward", sheet: "daily" }, ...base,
  },
  {
    label: "Toast · season takeover (berry · theme CTA → World Cup season screen)",
    id: "auto:theme", priority: 90, tone: "berry", emoji: "🏆",
    title: "World Cup season is live",
    body: "Themed rounds and bigger pools are here. Tap to open the season.",
    cta: { label: "View the season", theme: "world-cup" }, ...base,
  },
  {
    label: "SMALL MODAL (maple · surface:small, no CTA — tap opens a compact bottom-sheet)",
    id: "auto:small", priority: 50, tone: "maple", emoji: "✨",
    title: "Your weekly recap is ready",
    body: "You answered 42 questions this week at 78% accuracy and climbed 3 leagues.\n\nTap to see the full breakdown.",
    surface: "small", ...base,
  },
  {
    label: "FULL MODAL (leaf · surface:full, no CTA — tap opens a full-screen takeover)",
    id: "auto:full", priority: 40, tone: "leaf", emoji: "🔥",
    title: "You're on a 5-day streak",
    body: "Keep showing up and the rewards keep growing.\n\nMiss a day and the streak resets to zero — don't break the chain.",
    surface: "full", ...base,
  },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`Sending ${examples.length} example notifications to ${user.username} (${user.id}), ~5s apart:\n`);
for (let i = 0; i < examples.length; i++) {
  const { label, ...announcement } = examples[i];
  await deliverAnnouncementToUsers([user.id], announcement);
  console.log(`  ${i + 1}/${examples.length}  ${label}`);
  if (i < examples.length - 1) await wait(5000);
}
console.log("\nDone. Each should have appeared as a top toast in order.");

await prisma.$disconnect();
