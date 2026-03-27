import type { TicketPurchaseSource } from "@prisma";

export const DEFAULT_TICKET_PRICE = 1;

export interface TicketPricingConfig {
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
  return typeof firstPrice === "number" && firstPrice > 0
    ? firstPrice
    : DEFAULT_TICKET_PRICE;
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
  return Boolean(entry.paidAt || entry.purchaseSource === "FREE_ADMIN");
}
