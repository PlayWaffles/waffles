-- CreateEnum
CREATE TYPE "PendingPurchaseStatus" AS ENUM ('SUBMITTED', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "PendingPurchase" (
    "id" TEXT NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "platform" "UserPlatform" NOT NULL,
    "payerWallet" VARCHAR(42) NOT NULL,
    "expectedAmount" DOUBLE PRECISION NOT NULL,
    "status" "PendingPurchaseStatus" NOT NULL DEFAULT 'SUBMITTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(500),
    "syncedEntryId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPurchase_txHash_key" ON "PendingPurchase"("txHash");

-- CreateIndex
CREATE INDEX "PendingPurchase_status_updatedAt_idx" ON "PendingPurchase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "PendingPurchase_userId_createdAt_idx" ON "PendingPurchase"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "PendingPurchase_gameId_createdAt_idx" ON "PendingPurchase"("gameId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PendingPurchase" ADD CONSTRAINT "PendingPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingPurchase" ADD CONSTRAINT "PendingPurchase_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
