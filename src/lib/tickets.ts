import type { TicketPurchaseSource, UserPlatform } from "@prisma";

export const DEFAULT_TICKET_PRICE = 1;
export const MINIPAY_MINIMUM_TICKET_PRICE = 0.05;

export interface TicketPricingConfig {
  platform?: UserPlatform | null;
  tierPrices?: number[] | null;
}

export interface TicketPricingSnapshot {
  basePrice: number;
  currentPrice: number;
}

export interface TicketEntryLike {
  paidAt?: Date | null;
  purchaseSource?: TicketPurchaseSource | null;
}

export function getBaseTicketPrice(game: TicketPricingConfig): number {
  const firstPrice = game.tierPrices?.[0];
  const basePrice = typeof firstPrice === "number" && firstPrice > 0
    ? firstPrice
    : DEFAULT_TICKET_PRICE;

  return game.platform
    ? enforceMinimumTicketPriceForPlatform(basePrice, game.platform)
    : basePrice;
}

export function getMinimumTicketPriceForPlatform(platform: UserPlatform): number {
  return platform === "MINIPAY" ? MINIPAY_MINIMUM_TICKET_PRICE : 0;
}

export function enforceMinimumTicketPriceForPlatform(
  price: number,
  platform: UserPlatform,
): number {
  return Math.max(price, getMinimumTicketPriceForPlatform(platform));
}

export function getTicketPricingSnapshot(
  game: TicketPricingConfig,
): TicketPricingSnapshot {
  const basePrice = getBaseTicketPrice(game);

  return {
    basePrice,
    currentPrice: basePrice,
  };
}

export function hasPlayableTicket(entry: TicketEntryLike | null | undefined): boolean {
  if (!entry) return false;
  return Boolean(
    entry.paidAt ||
    entry.purchaseSource === "FREE_ADMIN" ||
    entry.purchaseSource === "FREE_PLAYER",
  );
}
