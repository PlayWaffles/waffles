-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TicketLedgerReason" ADD VALUE 'PARTNER_OFFER';
ALTER TYPE "TicketLedgerReason" ADD VALUE 'SEASON_PASS';

-- CreateTable
CREATE TABLE "PartnerOffer" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "brand" VARCHAR(60) NOT NULL,
    "brandColor" VARCHAR(9) NOT NULL,
    "glyph" VARCHAR(8) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "cta" VARCHAR(40) NOT NULL,
    "tickets" SMALLINT NOT NULL,
    "estTime" VARCHAR(20) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "hot" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "PartnerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOfferClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "tickets" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerOfferClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonPassClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "season" VARCHAR(20) NOT NULL,
    "tier" SMALLINT NOT NULL,
    "premium" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonPassClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOffer_slug_key" ON "PartnerOffer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOfferClaim_userId_offerId_key" ON "PartnerOfferClaim"("userId", "offerId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonPassClaim_userId_season_tier_premium_key" ON "SeasonPassClaim"("userId", "season", "tier", "premium");

-- AddForeignKey
ALTER TABLE "PartnerOfferClaim" ADD CONSTRAINT "PartnerOfferClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOfferClaim" ADD CONSTRAINT "PartnerOfferClaim_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PartnerOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonPassClaim" ADD CONSTRAINT "SeasonPassClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
