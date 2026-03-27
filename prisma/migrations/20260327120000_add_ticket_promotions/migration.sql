DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketPurchaseSource') THEN
    CREATE TYPE "TicketPurchaseSource" AS ENUM ('PAID', 'DISCOUNTED', 'FREE_ADMIN');
  END IF;
END $$;

ALTER TABLE "Game"
ADD COLUMN IF NOT EXISTS "earlyBirdEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "earlyBirdPrice" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "earlyBirdTicketLimit" INTEGER;

ALTER TABLE "GameEntry"
ADD COLUMN IF NOT EXISTS "purchaseSource" "TicketPurchaseSource" NOT NULL DEFAULT 'PAID',
ADD COLUMN IF NOT EXISTS "freeIssuedById" TEXT,
ADD COLUMN IF NOT EXISTS "freeIssueNote" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "GameEntry_gameId_purchaseSource_idx"
ON "GameEntry"("gameId", "purchaseSource");
