ALTER TABLE "Game"
ADD COLUMN "telegramStartedAt" TIMESTAMP(3),
ADD COLUMN "telegramResultsAt" TIMESTAMP(3);

CREATE INDEX "Game_telegramStartedAt_idx" ON "Game"("telegramStartedAt");
CREATE INDEX "Game_telegramResultsAt_idx" ON "Game"("telegramResultsAt");
