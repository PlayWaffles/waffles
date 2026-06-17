/**
 * Seeds v2 sponsored partner offers (Missions → Partners tab).
 *
 *   node --env-file=.env --import tsx scripts/seed-v2-partner-offers.ts
 */
const { prisma } = await import("@/lib/db");

const OFFERS = [
  { slug: "duolingo-lesson", brand: "Duolingo", brandColor: "#58CC02", glyph: "🦉", title: "Try a free language lesson", cta: "Open app", tickets: 3, estTime: "~2 min", verified: true, hot: false, sortOrder: 1 },
  { slug: "spotify-trial", brand: "Spotify", brandColor: "#1DB954", glyph: "♫", title: "Sign up for Spotify Free trial", cta: "Get offer", tickets: 5, estTime: "~5 min", verified: true, hot: false, sortOrder: 2 },
  { slug: "doordash-first-order", brand: "Doordash", brandColor: "#FF3008", glyph: "D", title: "Place your first order, $10 off", cta: "Claim", tickets: 10, estTime: "varies", verified: true, hot: true, sortOrder: 3 },
  { slug: "pulse-survey", brand: "Pulse", brandColor: "#FFC931", glyph: "?", title: "Answer a 5-min market survey", cta: "Start", tickets: 2, estTime: "~5 min", verified: true, hot: false, sortOrder: 4 },
  { slug: "lyft-first-ride", brand: "Lyft", brandColor: "#FF00BF", glyph: "L", title: "First ride, up to $5 off", cta: "Claim", tickets: 8, estTime: "~2 min", verified: true, hot: false, sortOrder: 5 },
  { slug: "calm-trial", brand: "Calm", brandColor: "#3a8df1", glyph: "☾", title: "Try a free 7-day trial", cta: "Open app", tickets: 6, estTime: "~3 min", verified: true, hot: false, sortOrder: 6 },
];

for (const o of OFFERS) {
  await prisma.partnerOffer.upsert({
    where: { slug: o.slug },
    create: o,
    update: {
      brand: o.brand,
      brandColor: o.brandColor,
      glyph: o.glyph,
      title: o.title,
      cta: o.cta,
      tickets: o.tickets,
      estTime: o.estTime,
      verified: o.verified,
      hot: o.hot,
      sortOrder: o.sortOrder,
      isActive: true,
    },
  });
}

const count = await prisma.partnerOffer.count({ where: { isActive: true } });
console.log(`seeded ${count} partner offers`);
await prisma.$disconnect();

export {};
