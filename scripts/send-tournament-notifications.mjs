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

// Tournament lifecycle for MiniPay (USDT, 0.10 entry, no push framing):
// open → filling → boosted → starting → live(flipped) → settled → won → claimed.
const examples = [
  {
    label: "gameOpen — round live (maple · CTA → join on Home)",
    id: "auto:tour-open", priority: 70, tone: "maple", emoji: "🎟️",
    title: "Today's round is live",
    body: "0.10 USDT to enter, winners split the pool. Jump in before it fills up.",
    cta: { label: "Join the round", screen: "home" }, ...base,
  },
  {
    label: "almostSoldOut — filling up (leaf · CTA → Home)",
    id: "auto:tour-almost", priority: 75, tone: "leaf", emoji: "🔥",
    title: "Almost full",
    body: "Only 8 spots left in the live round. Grab yours before it closes.",
    cta: { label: "Grab a spot", screen: "home" }, ...base,
  },
  {
    label: "prizePoolBoost — pool grew (maple · CTA → Home)",
    id: "auto:tour-boost", priority: 80, tone: "maple", emoji: "💰",
    title: "The prize pool just grew",
    body: "Bigger USDT payouts this round — same 0.10 USDT to enter.",
    cta: { label: "See the pool", screen: "home" }, ...base,
  },
  {
    label: "countdown5min — starting soon (leaf · CTA → Home/lobby)",
    id: "auto:tour-5min", priority: 85, tone: "leaf", emoji: "⏰",
    title: "Starting in 5 minutes",
    body: "The round's about to begin. Get ready to play.",
    cta: { label: "Get ready", screen: "home" }, ...base,
  },
  {
    label: "flipped — passed on leaderboard (berry · CTA → leaderboard)",
    id: "auto:tour-flipped", priority: 90, tone: "berry", emoji: "⚡",
    title: "SwiftFalcon23 just passed you",
    body: "You've slipped a place in the live round. Answer faster to take it back.",
    cta: { label: "See standings", screen: "leaderboard" }, ...base,
  },
  {
    label: "results — settled, non-winner (leaf · CTA → results screen)",
    id: "auto:tour-results", priority: 80, tone: "leaf", emoji: "🎯",
    title: "The round's settled",
    body: "See who won and exactly where you placed.",
    cta: { label: "See your result", screen: "results" }, ...base,
  },
  {
    label: "winner — top finish (maple · CTA → Prize Wallet)",
    id: "auto:tour-winner", priority: 100, tone: "maple", emoji: "🥇",
    title: "You finished #1",
    body: "0.40 USDT is yours. Tap to claim it from your Prize Wallet.",
    cta: { label: "Claim your prize", screen: "profile" }, ...base,
  },
  {
    label: "claimed — claim confirmation (leaf · info, no CTA)",
    id: "auto:tour-claimed", priority: 60, tone: "leaf", emoji: "✅",
    title: "Prize claimed",
    body: "0.40 USDT is on its way to your wallet. See you in the next round.",
    surface: "toast", ...base,
  },
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
