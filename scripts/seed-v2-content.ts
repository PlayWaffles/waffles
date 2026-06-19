/**
 * Seeds Announcement rows (ids match the client's stable announcement ids, so
 * AnnouncementState read/dismiss FK-resolves) + a parity set of multi-format
 * QuestionTemplates (multi / order / spatial).
 *
 *   node --env-file=.env --import tsx scripts/seed-v2-content.ts
 */
const { prisma } = await import("@/lib/db");
const { GameTheme, Difficulty, QuestionKind } = await import("@prisma");

// ── Announcements (id = the client's announcement id, mirrors announcements.tsx) ──
// sortOrder doubles as banner priority (higher shows first). tone + emoji drive
// the in-app card styling; ctaAction is "screen:<name>" | "theme:<id>".
const ANNOUNCEMENTS = [
  // Feed card mirroring the one-time "What's new" migration modal
  // (MigrationTakeover) so the rundown stays readable from the bell. Framed as a
  // universal welcome (no "redesigned/glow-up" wording), since it shows to ALL
  // players — new users too, not just migrated ones. (The separate
  // `v2-migration-welcome` row, kind "migration", only gates the modal's dismiss
  // state and is hidden from the feed.)
  { id: "whats-new-v2", title: "Welcome to Waffles", body: "Here's what you can do: climb the level path, earn XP as you play, and collect Syrup to spend in the shop. There's a new tournament every hour, daily missions to knock out, and daily rewards & streaks for showing up.", sortOrder: 35, tone: "maple", emoji: "🧇", ctaLabel: "Take a look", ctaAction: "screen:home" },
  { id: "world-cup-season", title: "The World Cup is here", body: "Football trivia, live every hour, with real prizes on the line. See what's new this season.", sortOrder: 40, tone: "leaf", emoji: "⚽", ctaLabel: "See what's new", ctaAction: "theme:world-cup" },
  { id: "prize-wallet", title: "Cash out your winnings", body: "Tournament prizes are paid in USDT. Claim them anytime from your new Prize Wallet.", sortOrder: 30, tone: "leaf", emoji: "💸", ctaLabel: "Open Prize Wallet", ctaAction: "screen:profile" },
  { id: "double-xp-weekend", title: "Double XP weekend", body: "Every tournament you play this weekend earns 2× XP. Climb the leagues faster.", sortOrder: 20, tone: "berry", emoji: "⚡", ctaLabel: "Play now", ctaAction: "screen:home" },
  { id: "prize-pool-boost", title: "Prize pool boosted", body: "Top of the Hour now pays out up to 25 tickets — finish Top 100 to win.", sortOrder: 10, tone: "maple", emoji: "🏆", ctaLabel: null, ctaAction: null },
];

for (const a of ANNOUNCEMENTS) {
  const data = { title: a.title, body: a.body, sortOrder: a.sortOrder, tone: a.tone, emoji: a.emoji, ctaLabel: a.ctaLabel, ctaAction: a.ctaAction, isActive: true };
  await prisma.announcement.upsert({
    where: { id: a.id },
    create: { id: a.id, slug: a.id, ...data },
    update: data,
  });
}

// v2-migration welcome modal. The rich content lives in the MigrationTakeover
// component; this row backs the per-user dismiss state (AnnouncementState FK).
await prisma.announcement.upsert({
  where: { id: "v2-migration-welcome" },
  create: { id: "v2-migration-welcome", slug: "v2-migration-welcome", title: "Waffles got a glow-up", body: "Fresh look, Levels, XP, Syrup, hourly games, daily missions & streaks.", kind: "migration", sortOrder: 0, isActive: true },
  update: { kind: "migration", isActive: true },
});

// ── Multi-format question parity (mirrors FORMAT_REGISTRY in state.tsx) ──
const MULTI = [
  { content: "Pick the 3 nations that have WON the World Cup", options: ["Brazil", "Germany", "Argentina", "Netherlands", "Mexico", "Croatia"], kind: QuestionKind.MULTI, correctSet: [0, 1, 2], pick: 3 },
  { content: "Pick the 3 host nations of the 2026 World Cup", options: ["USA", "Canada", "Mexico", "Qatar", "Brazil", "Spain"], kind: QuestionKind.MULTI, correctSet: [0, 1, 2], pick: 3 },
  { content: "Order these World Cup winners — oldest to newest", options: ["France", "Argentina", "Spain", "Germany"], kind: QuestionKind.ORDER, correctOrder: [2, 3, 0, 1] },
  { content: "Tap the country that HOSTED the 2022 World Cup", options: ["Russia", "Brazil", "Qatar", "Japan", "Mexico", "Germany"], kind: QuestionKind.SPATIAL, correctIndex: 2, flags: ["🇷🇺", "🇧🇷", "🇶🇦", "🇯🇵", "🇲🇽", "🇩🇪"] },
  { content: "Tap the country that WON the 2018 World Cup", options: ["France", "Croatia", "England", "Belgium", "Brazil", "Argentina"], kind: QuestionKind.SPATIAL, correctIndex: 0, flags: ["🇫🇷", "🇭🇷", "🏴", "🇧🇪", "🇧🇷", "🇦🇷"] },
];

// Idempotent-ish: clear prior multi-format rows (non-SINGLE) then insert.
await prisma.questionTemplate.deleteMany({ where: { kind: { not: QuestionKind.SINGLE } } });
for (const m of MULTI) {
  await prisma.questionTemplate.create({
    data: {
      content: m.content,
      options: m.options,
      correctIndex: m.correctIndex ?? 0,
      theme: GameTheme.FOOTBALL,
      category: "Sports",
      difficulty: Difficulty.MEDIUM,
      kind: m.kind,
      correctSet: m.correctSet ?? [],
      pick: m.pick,
      correctOrder: m.correctOrder ?? [],
      flags: m.flags ?? [],
    },
  });
}

const [ann, multi] = await Promise.all([
  prisma.announcement.count(),
  prisma.questionTemplate.count({ where: { kind: { not: QuestionKind.SINGLE } } }),
]);
console.log(`seeded ${ann} announcements, ${multi} multi-format questions`);
await prisma.$disconnect();

export {};
