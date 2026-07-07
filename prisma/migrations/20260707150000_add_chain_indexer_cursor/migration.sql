-- CreateTable
CREATE TABLE "ChainIndexerCursor" (
    "id" TEXT NOT NULL,
    "chainKey" VARCHAR(64) NOT NULL,
    "contract" VARCHAR(42) NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainIndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainIndexerCursor_chainKey_key" ON "ChainIndexerCursor"("chainKey");
