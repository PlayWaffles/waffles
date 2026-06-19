/**
 * Seeds the shop catalog (mirrors src/app/v2/_app/screens/shop.tsx) into ShopItem.
 * Idempotent: upserts by slug.
 *
 *   node --env-file=.env --import tsx scripts/seed-v2-shop.ts
 */
import type { Prisma } from "@prisma";
const { prisma } = await import("@/lib/db");
const { ShopItemKind } = await import("@prisma");

type Seed = {
  slug: string;
  kind: (typeof ShopItemKind)[keyof typeof ShopItemKind];
  label: string;
  sub?: string;
  priceTickets?: number;
  priceFiat?: number;
  payload?: Prisma.InputJsonValue;
  color?: string;
  sortOrder: number;
};

const ITEMS: Seed[] = [
  // Power-ups (payload.powerUp = PowerUpKind enum)
  { slug: "pu-5050", kind: ShopItemKind.POWERUP, label: "50/50", sub: "Eliminate 2 wrong", priceTickets: 4, payload: { powerUp: "FIFTY_FIFTY" }, color: "#00CFF2", sortOrder: 1 },
  { slug: "pu-time", kind: ShopItemKind.POWERUP, label: "+5 sec", sub: "Per question, once", priceTickets: 3, payload: { powerUp: "EXTRA_TIME" }, color: "#FFC931", sortOrder: 2 },
  { slug: "pu-skip", kind: ShopItemKind.POWERUP, label: "Skip", sub: "Pass on one Q", priceTickets: 5, payload: { powerUp: "SKIP" }, color: "#FB72FF", sortOrder: 3 },
  { slug: "pu-shield", kind: ShopItemKind.POWERUP, label: "Shield", sub: "Protect 1 streak", priceTickets: 5, payload: { powerUp: "SHIELD" }, color: "#00CFF2", sortOrder: 4 },
  // Cosmetics (payload.cosmetic = CosmeticKind enum)
  { slug: "frame-gold", kind: ShopItemKind.COSMETIC, label: "Gold Frame", sub: "Avatar frame", priceTickets: 8, payload: { cosmetic: "AVATAR_FRAME" }, color: "#FFC931", sortOrder: 5 },
  { slug: "name-pink", kind: ShopItemKind.COSMETIC, label: "Pink Name", sub: "Name color", priceTickets: 6, payload: { cosmetic: "NAME_COLOR" }, color: "#FB72FF", sortOrder: 6 },
  { slug: "emote-waffle", kind: ShopItemKind.COSMETIC, label: "Waffle Emote", sub: "Emote", priceTickets: 4, payload: { cosmetic: "EMOTE" }, color: "#00CFF2", sortOrder: 7 },
  // Featured boost (DOUBLE_XP, 3 charges)
  { slug: "boost-double-xp", kind: ShopItemKind.FEATURED, label: "Double XP", sub: "Boost your tournament hauls", priceTickets: 5, payload: { boost: "DOUBLE_XP", charges: 3 }, color: "#FB72FF", sortOrder: 8 },
  // Bundles (fiat top-ups; payment rail TBD → purchase returns "fiat-only")
  { slug: "bundle-5", kind: ShopItemKind.BUNDLE, label: "5 Tickets", priceFiat: 0.99, payload: { count: 5, bonus: 0 }, sortOrder: 9 },
  { slug: "bundle-25", kind: ShopItemKind.BUNDLE, label: "25 Tickets", sub: "POPULAR", priceFiat: 3.99, payload: { count: 25, bonus: 5 }, sortOrder: 10 },
  { slug: "bundle-60", kind: ShopItemKind.BUNDLE, label: "60 Tickets", sub: "BEST", priceFiat: 7.99, payload: { count: 60, bonus: 20 }, sortOrder: 11 },
];

for (const it of ITEMS) {
  await prisma.shopItem.upsert({
    where: { slug: it.slug },
    create: {
      slug: it.slug,
      kind: it.kind,
      label: it.label,
      sub: it.sub,
      priceTickets: it.priceTickets,
      priceFiat: it.priceFiat,
      payload: it.payload,
      color: it.color,
      sortOrder: it.sortOrder,
    },
    update: {
      kind: it.kind,
      label: it.label,
      sub: it.sub,
      priceTickets: it.priceTickets,
      priceFiat: it.priceFiat,
      payload: it.payload,
      color: it.color,
      sortOrder: it.sortOrder,
    },
  });
}

const count = await prisma.shopItem.count();
console.log(`shop catalog seeded — ${count} items`);
await prisma.$disconnect();

export {};
