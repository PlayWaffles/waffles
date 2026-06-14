/**
 * v2 economy services — daily reward roll, shop purchases, and inventory grants.
 * Server-authoritative; mirrors the pure logic in the ported screens
 * (daily-reward.tsx REWARD_POOL, shop.tsx catalog) but is the source of truth.
 */
import { prisma } from "@/lib/db";
import {
  BoostKind,
  CosmeticKind,
  PowerUpKind,
  ShopItemKind,
  TicketLedgerReason,
} from "@prisma";
import { adjustTickets } from "./playerState";

// ── Daily reward (mirrors daily-reward.tsx REWARD_POOL + rollReward) ─────────
type Roll = { type: "xp" | "ticket"; amount: number; rarity: "common" | "rare" | "jackpot" };

const REWARD_POOL: { roll: Roll; weight: number }[] = [
  { roll: { type: "xp", amount: 25, rarity: "common" }, weight: 26 },
  { roll: { type: "ticket", amount: 1, rarity: "common" }, weight: 26 },
  { roll: { type: "xp", amount: 50, rarity: "common" }, weight: 16 },
  { roll: { type: "ticket", amount: 2, rarity: "rare" }, weight: 14 },
  { roll: { type: "xp", amount: 100, rarity: "rare" }, weight: 8 },
  { roll: { type: "ticket", amount: 5, rarity: "jackpot" }, weight: 3 },
  { roll: { type: "ticket", amount: 10, rarity: "jackpot" }, weight: 1 },
];

function rollReward(streak: number): Roll {
  const boost = 1 + Math.min(streak, 30) / 15; // 1× → 3×
  const weighted = REWARD_POOL.map((e) => ({
    roll: e.roll,
    w: e.roll.rarity === "common" ? e.weight : e.weight * boost,
  }));
  const total = weighted.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of weighted) if ((r -= e.w) <= 0) return e.roll;
  return weighted[0].roll;
}

const dayKeyUTC = (d = new Date()): string => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export type DailyClaimResult =
  | { claimed: false; reason: "already-claimed" }
  | { claimed: true; roll: Roll; streak: number; usedFreeze: boolean; tickets: number; xp: number };

/** Claim today's daily reward (one per UTC day). Resolves the streak (continue /
 *  freeze-save / reset), rolls a streak-weighted prize, credits it. */
export async function claimDailyReward(userId: string): Promise<DailyClaimResult> {
  return prisma.$transaction(async (tx) => {
    const today = dayKeyUTC();
    const existing = await tx.dailyRewardClaim.findUnique({
      where: { userId_dayKey: { userId, dayKey: today } },
      select: { id: true },
    });
    if (existing) return { claimed: false, reason: "already-claimed" } as const;

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { currentStreak: true, bestStreak: true, streakFreezes: true },
    });
    const last = await tx.dailyRewardClaim.findFirst({
      where: { userId },
      orderBy: { dayKey: "desc" },
      select: { dayKey: true },
    });

    // Resolve streak continuity.
    let streak: number;
    let usedFreeze = false;
    let freezes = user.streakFreezes;
    if (!last) {
      streak = 1;
    } else {
      const gap = daysBetween(last.dayKey, today);
      if (gap <= 1) {
        streak = user.currentStreak + 1;
      } else if (freezes > 0) {
        streak = user.currentStreak + 1;
        usedFreeze = true;
        freezes -= 1;
      } else {
        streak = 1;
      }
    }

    const roll = rollReward(streak);

    await tx.dailyRewardClaim.create({
      data: { userId, dayKey: today, streak, reward: roll, usedFreeze },
    });

    let tickets = 0;
    if (roll.type === "ticket") {
      tickets = await adjustTickets(userId, roll.amount, TicketLedgerReason.DAILY_REWARD, {
        refId: today,
        tx,
      });
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak: streak,
        bestStreak: Math.max(user.bestStreak, streak),
        streakFreezes: freezes,
        lastLoginAt: new Date(),
        ...(roll.type === "xp" ? { xp: { increment: roll.amount } } : {}),
      },
      select: { ticketBalance: true, xp: true },
    });

    return {
      claimed: true,
      roll,
      streak,
      usedFreeze,
      tickets: roll.type === "ticket" ? tickets : updated.ticketBalance,
      xp: updated.xp,
    } as const;
  });
}

// ── Inventory grants ─────────────────────────────────────────────────────────
export async function grantPowerUp(userId: string, kind: PowerUpKind, n = 1): Promise<void> {
  await prisma.powerUpInventory.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, count: n },
    update: { count: { increment: n } },
  });
}

export async function grantCosmetic(userId: string, slug: string, kind: CosmeticKind): Promise<void> {
  await prisma.userCosmetic.upsert({
    where: { userId_slug: { userId, slug } },
    create: { userId, slug, kind },
    update: {},
  });
}

export async function grantBoost(
  userId: string,
  kind: BoostKind,
  charges: number | null,
  expiresAt: Date | null,
): Promise<void> {
  await prisma.userBoost.create({
    data: { userId, kind, remainingCharges: charges, expiresAt },
  });
}

// ── Shop purchase ─────────────────────────────────────────────────────────────
export type PurchaseResult =
  | { ok: false; reason: "not-found" | "insufficient-tickets" | "fiat-only" }
  | { ok: true; tickets: number };

/** Buy a catalog item with tickets. Bundles (fiat top-ups) are out of scope here
 *  until the payment rail is decided — they return "fiat-only". */
export async function purchaseShopItem(userId: string, slug: string): Promise<PurchaseResult> {
  const item = await prisma.shopItem.findUnique({ where: { slug } });
  if (!item || !item.isActive) return { ok: false, reason: "not-found" };
  if (item.kind === ShopItemKind.BUNDLE) return { ok: false, reason: "fiat-only" };
  if (item.priceTickets == null) return { ok: false, reason: "fiat-only" };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ticketBalance: true },
    });
    if (user.ticketBalance < item.priceTickets!) {
      return { ok: false, reason: "insufficient-tickets" } as const;
    }
    const tickets = await adjustTickets(userId, -item.priceTickets!, TicketLedgerReason.SHOP_PURCHASE, {
      refId: item.slug,
      tx,
    });
    await tx.purchase.create({
      data: { userId, itemId: item.id, spentTickets: item.priceTickets!, qty: 1 },
    });

    // Grant per kind. payload carries the concrete kind/charges.
    const payload = (item.payload ?? {}) as Record<string, unknown>;
    if (item.kind === ShopItemKind.POWERUP && typeof payload.powerUp === "string") {
      await grantPowerUpTx(tx, userId, payload.powerUp as PowerUpKind);
    } else if (item.kind === ShopItemKind.COSMETIC && typeof payload.cosmetic === "string") {
      await tx.userCosmetic.upsert({
        where: { userId_slug: { userId, slug: item.slug } },
        create: { userId, slug: item.slug, kind: payload.cosmetic as CosmeticKind },
        update: {},
      });
    } else if (item.kind === ShopItemKind.BOOST || item.kind === ShopItemKind.FEATURED) {
      await tx.userBoost.create({
        data: {
          userId,
          kind: BoostKind.DOUBLE_XP,
          remainingCharges: typeof payload.charges === "number" ? payload.charges : null,
          expiresAt: null,
        },
      });
    }
    return { ok: true, tickets } as const;
  });
}

// transaction-scoped powerup grant (the exported grantPowerUp uses its own client)
async function grantPowerUpTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  kind: PowerUpKind,
): Promise<void> {
  await tx.powerUpInventory.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, count: 1 },
    update: { count: { increment: 1 } },
  });
}
