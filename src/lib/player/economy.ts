/**
 * v2 economy services — daily reward, shop catalog/purchases, and inventory
 * grants. Server-authoritative source of truth: the shop catalog (loadShopCatalog)
 * drives the client UI, and the daily reward mirrors daily-reward.tsx DAILY_SCHEDULE.
 */
import { prisma } from "@/lib/db";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";
import {
  BoostKind,
  CosmeticKind,
  PowerUpKind,
  ShopItemKind,
  TicketLedgerReason,
} from "@prisma";
import { dayKeyUTC, resolveLoginStreak } from "./dailyStreak";
import { adjustTickets } from "./playerState";

// ── Daily reward — fixed 7-day calendar (mirrors daily-reward.tsx DAILY_SCHEDULE)
// The reward for a day is deterministic by its position in the repeating 7-day
// cycle, so the calendar the player sees is exactly what gets credited.
type Roll = { type: "xp" | "ticket"; amount: number; rarity: "common" | "rare" | "jackpot" };

// Kept in the game's 1–10 Syrup scale (lives refill 1, freeze 2, power-ups 1–2,
// cosmetics 4–8) so a week of logins (~21 Syrup) doesn't trivialize the shop.
const DAILY_SCHEDULE: Roll[] = [
  { type: "ticket", amount: 1, rarity: "common" },   // Day 1
  { type: "ticket", amount: 2, rarity: "common" },   // Day 2
  { type: "xp", amount: 25, rarity: "common" },      // Day 3
  { type: "ticket", amount: 3, rarity: "rare" },     // Day 4
  { type: "xp", amount: 50, rarity: "rare" },        // Day 5
  { type: "ticket", amount: 5, rarity: "rare" },     // Day 6
  { type: "ticket", amount: 10, rarity: "jackpot" }, // Day 7
];

/** The reward for the given (1-based) streak day — repeats every 7 days. */
function rewardForStreak(streak: number): Roll {
  return DAILY_SCHEDULE[(Math.max(1, streak) - 1) % DAILY_SCHEDULE.length];
}

export type DailyClaimResult =
  | { claimed: false; reason: "already-claimed" }
  | { claimed: true; roll: Roll; streak: number; usedFreeze: boolean; tickets: number; xp: number };

/** Claim today's daily reward (one per UTC day), using the login streak as the
 *  streak authority and the claim row only as the duplicate-claim guard. */
export async function claimDailyReward(userId: string): Promise<DailyClaimResult> {
  return prisma.$transaction(async (tx) => {
    const today = dayKeyUTC();
    const existing = await tx.dailyRewardClaim.findUnique({
      where: { userId_dayKey: { userId, dayKey: today } },
      select: { id: true },
    });
    if (existing) {
      await trackServerEvent({
        name: "daily_reward_claim_authoritative",
        userId,
        tx,
        properties: {
          result: "already_claimed",
          reward_type: null,
          reward_amount: null,
        },
      });
      return { claimed: false, reason: "already-claimed" } as const;
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        currentStreak: true,
        bestStreak: true,
        lastLoginAt: true,
      },
    });

    const resolvedStreak = resolveLoginStreak(user);
    const streak = resolvedStreak.currentStreak;
    const usedFreeze = false;

    const roll = rewardForStreak(streak);

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
        bestStreak: resolvedStreak.bestStreak,
        lastLoginAt: resolvedStreak.lastLoginAt,
        ...(roll.type === "xp" ? { xp: { increment: roll.amount } } : {}),
      },
      select: { ticketBalance: true, xp: true },
    });
    await trackServerEvent({
      name: "daily_reward_claim_authoritative",
      userId,
      tx,
      properties: {
        result: "claimed",
        reward_type: roll.type,
        reward_amount: roll.amount,
        rarity: roll.rarity,
        streak_days: streak,
        used_freeze: usedFreeze,
        tickets_after: roll.type === "ticket" ? tickets : updated.ticketBalance,
        xp_after: updated.xp,
      },
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
  if (!item || !item.isActive) {
    await trackServerEvent({
      name: "shop_purchase_authoritative",
      userId,
      properties: {
        result: "not_found",
        sku: slug,
      },
    });
    return { ok: false, reason: "not-found" };
  }
  if (item.kind === ShopItemKind.BUNDLE || item.priceTickets == null) {
    await trackServerEvent({
      name: "shop_purchase_authoritative",
      userId,
      properties: {
        result: "fiat_only",
        sku: item.slug,
        item_kind: item.kind,
      },
    });
    return { ok: false, reason: "fiat-only" };
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { ticketBalance: true },
    });
    if (user.ticketBalance < item.priceTickets!) {
      await trackServerEvent({
        name: "shop_purchase_authoritative",
        userId,
        tx,
        properties: {
          result: "insufficient_tickets",
          sku: item.slug,
          item_kind: item.kind,
          price_tickets: item.priceTickets,
          tickets_before: user.ticketBalance,
        },
      });
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
    await trackServerEvent({
      name: "shop_purchase_authoritative",
      userId,
      tx,
      properties: {
        result: "purchased",
        sku: item.slug,
        item_kind: item.kind,
        price_tickets: item.priceTickets,
        tickets_before: user.ticketBalance,
        tickets_after: tickets,
        purchase_id_hash: hashServerAnalyticsId(item.id),
      },
    });
    return { ok: true, tickets } as const;
  });
}

// ── Power-up inventory: load + consume (used in the live quiz) ───────────────
export async function loadPowerUps(userId: string): Promise<Record<PowerUpKind, number>> {
  const rows = await prisma.powerUpInventory.findMany({
    where: { userId },
    select: { kind: true, count: true },
  });
  const out: Record<PowerUpKind, number> = {
    [PowerUpKind.FIFTY_FIFTY]: 0,
    [PowerUpKind.EXTRA_TIME]: 0,
    [PowerUpKind.SKIP]: 0,
    [PowerUpKind.SHIELD]: 0,
  };
  for (const r of rows) out[r.kind] = r.count;
  return out;
}

export async function consumePowerUp(
  userId: string,
  kind: PowerUpKind,
): Promise<{ ok: boolean; remaining: number }> {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.powerUpInventory.findUnique({
      where: { userId_kind: { userId, kind } },
      select: { count: true },
    });
    if (!inv || inv.count <= 0) {
      await trackServerEvent({
        name: "powerup_consume_authoritative",
        userId,
        tx,
        properties: {
          result: "empty",
          powerup_id: kind,
          inventory_before: inv?.count ?? 0,
          inventory_after: inv?.count ?? 0,
        },
      });
      return { ok: false, remaining: inv?.count ?? 0 };
    }
    const updated = await tx.powerUpInventory.update({
      where: { userId_kind: { userId, kind } },
      data: { count: { decrement: 1 } },
      select: { count: true },
    });
    await trackServerEvent({
      name: "powerup_consume_authoritative",
      userId,
      tx,
      properties: {
        result: "consumed",
        powerup_id: kind,
        inventory_before: inv.count,
        inventory_after: updated.count,
      },
    });
    return { ok: true, remaining: updated.count };
  });
}

// ── Streak freeze (bought with tickets; consumed by claimDailyReward) ────────
export const STREAK_FREEZE_COST = 2;

export async function buyStreakFreeze(userId: string): Promise<{ tickets: number; freezes: number } | null> {
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { ticketBalance: true } });
    if (u.ticketBalance < STREAK_FREEZE_COST) {
      await trackServerEvent({
        name: "streak_freeze_purchase_authoritative",
        userId,
        tx,
        properties: {
          result: "insufficient_tickets",
          tickets_before: u.ticketBalance,
          price_tickets: STREAK_FREEZE_COST,
        },
      });
      return null;
    }
    const tickets = await adjustTickets(userId, -STREAK_FREEZE_COST, TicketLedgerReason.SHOP_PURCHASE, {
      note: "streak-freeze",
      tx,
    });
    const updated = await tx.user.update({
      where: { id: userId },
      data: { streakFreezes: { increment: 1 } },
      select: { streakFreezes: true },
    });
    await trackServerEvent({
      name: "streak_freeze_purchase_authoritative",
      userId,
      tx,
      properties: {
        result: "purchased",
        tickets_before: u.ticketBalance,
        tickets_after: tickets,
        freezes_after: updated.streakFreezes,
        price_tickets: STREAK_FREEZE_COST,
      },
    });
    return { tickets, freezes: updated.streakFreezes };
  });
}

// ── Bundle top-up (buy tickets) ───────────────────────────────────────────────
// Credits the bundle's tickets and records the purchase. NOTE: this does NOT yet
// verify a real payment — the fiat/crypto payment rail is the one open product
// decision. `txHash` is accepted for the future on-chain-verified path; until a
// rail is chosen this mirrors the prototype's simulated checkout (off-chain credit).
export async function buyBundle(
  userId: string,
  slug: string,
  txHash?: string,
): Promise<{ tickets: number } | null> {
  const item = await prisma.shopItem.findUnique({ where: { slug } });
  if (!item || item.kind !== ShopItemKind.BUNDLE) return null;
  const payload = (item.payload ?? {}) as { count?: number; bonus?: number };
  const total = (payload.count ?? 0) + (payload.bonus ?? 0);
  if (total <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const tickets = await adjustTickets(userId, total, TicketLedgerReason.BUNDLE_TOPUP, { refId: slug, tx });
    await tx.purchase.create({
      data: { userId, itemId: item.id, spentTickets: 0, spentFiat: item.priceFiat ?? null, txHash: txHash ?? null },
    });
    await trackServerEvent({
      name: "bundle_topup_authoritative",
      userId,
      tx,
      properties: {
        result: "credited",
        sku: slug,
        bundle_id: slug,
        ticket_delta: total,
        tickets_after: tickets,
        price_usdt: item.priceFiat ? Number(item.priceFiat) : null,
        tx_present: Boolean(txHash),
      },
    });
    return { tickets };
  });
}

// Transaction-scoped grants (the non-Tx exports above use their own client).
// Exported so league settlement can do the rank/outcome write + reward grant
// atomically in one transaction.
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function grantPowerUpTx(tx: Tx, userId: string, kind: PowerUpKind, n = 1): Promise<void> {
  await tx.powerUpInventory.upsert({
    where: { userId_kind: { userId, kind } },
    create: { userId, kind, count: n },
    update: { count: { increment: n } },
  });
}

export async function grantBoostTx(
  tx: Tx,
  userId: string,
  kind: BoostKind,
  charges: number | null,
  expiresAt: Date | null,
): Promise<void> {
  await tx.userBoost.create({ data: { userId, kind, remainingCharges: charges, expiresAt } });
}

// ── Shop catalog (single source of truth for prices/labels) ─────────────────
// The client renders the shop from THIS (via getShopCatalog) instead of its
// own hardcoded constants, so the price shown is always the price charged.
export type ShopCatalogItem = {
  slug: string;
  kind: ShopItemKind;
  label: string;
  sub: string | null;
  priceTickets: number | null;
  priceFiat: number | null;
  color: string | null;
  payload: unknown;
};
export type ShopCatalog = { items: ShopCatalogItem[]; ownedCosmetics: string[] };

/** Active catalog ordered for display, plus the cosmetic slugs this user owns. */
export async function loadShopCatalog(userId: string): Promise<ShopCatalog> {
  const [items, owned] = await Promise.all([
    prisma.shopItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        kind: true,
        label: true,
        sub: true,
        priceTickets: true,
        priceFiat: true,
        color: true,
        payload: true,
      },
    }),
    prisma.userCosmetic.findMany({ where: { userId }, select: { slug: true } }),
  ]);
  return { items, ownedCosmetics: owned.map((o) => o.slug) };
}
