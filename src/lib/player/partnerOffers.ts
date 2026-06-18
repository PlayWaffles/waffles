/**
 * Sponsored partner offers (Missions → Partners tab). Definitions are catalog
 * rows (PartnerOffer); a per-user one-time PartnerOfferClaim credits the offer's
 * ticket reward. Seeded by scripts/seed-v2-partner-offers.ts.
 */
import { prisma } from "@/lib/db";
import { hashServerAnalyticsId, trackServerEvent } from "@/lib/server-analytics";
import { TicketLedgerReason } from "@prisma";
import { adjustTickets } from "./playerState";

export type PartnerOffer = {
  slug: string;
  brand: string;
  brandColor: string;
  glyph: string;
  title: string;
  cta: string;
  tickets: number;
  estTime: string;
  verified: boolean;
  hot: boolean;
  claimed: boolean;
};

export async function loadPartnerOffers(userId?: string): Promise<PartnerOffer[]> {
  const offers = await prisma.partnerOffer.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const claimedIds = userId
    ? new Set(
        (
          await prisma.partnerOfferClaim.findMany({
            where: { userId },
            select: { offerId: true },
          })
        ).map((c) => c.offerId),
      )
    : new Set<string>();

  return offers.map((o) => ({
    slug: o.slug,
    brand: o.brand,
    brandColor: o.brandColor,
    glyph: o.glyph,
    title: o.title,
    cta: o.cta,
    tickets: o.tickets,
    estTime: o.estTime,
    verified: o.verified,
    hot: o.hot,
    claimed: claimedIds.has(o.id),
  }));
}

export type PartnerClaimResult = {
  ok: boolean;
  reason?: "missing" | "already";
  tickets: number | null;
};

/** Complete a partner offer once: record the claim and credit its tickets. */
export async function claimPartnerOffer(
  userId: string,
  slug: string,
): Promise<PartnerClaimResult> {
  const offer = await prisma.partnerOffer.findUnique({ where: { slug } });
  if (!offer || !offer.isActive) {
    await trackServerEvent({
      name: "partner_offer_claim_authoritative",
      userId,
      properties: {
        result: "missing",
        partner_offer_id_hash: hashServerAnalyticsId(slug),
      },
    });
    return { ok: false, reason: "missing", tickets: null };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.partnerOfferClaim.findUnique({
      where: { userId_offerId: { userId, offerId: offer.id } },
      select: { id: true },
    });
    if (existing) {
      await trackServerEvent({
        name: "partner_offer_claim_authoritative",
        userId,
        tx,
        properties: {
          result: "already_claimed",
          partner_offer_id_hash: hashServerAnalyticsId(offer.slug),
          reward_type: "tickets",
          reward_amount: offer.tickets,
        },
      });
      return { ok: false, reason: "already" as const, tickets: null };
    }

    const claim = await tx.partnerOfferClaim.create({
      data: { userId, offerId: offer.id, tickets: offer.tickets },
      select: { id: true },
    });
    const tickets = await adjustTickets(userId, offer.tickets, TicketLedgerReason.PARTNER_OFFER, {
      refId: offer.slug,
      tx,
    });
    await trackServerEvent({
      name: "partner_offer_claim_authoritative",
      userId,
      tx,
      properties: {
        result: "claimed",
        partner_offer_id_hash: hashServerAnalyticsId(offer.slug),
        partner_claim_id_hash: hashServerAnalyticsId(claim.id),
        reward_type: "tickets",
        reward_amount: offer.tickets,
        tickets_after: tickets,
      },
    });
    return { ok: true, tickets };
  });
}
