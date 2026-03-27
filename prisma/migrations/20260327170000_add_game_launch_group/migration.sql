ALTER TABLE "Game"
ADD COLUMN IF NOT EXISTS "launchGroupId" VARCHAR(36);

CREATE UNIQUE INDEX IF NOT EXISTS "Game_launchGroupId_platform_key"
ON "Game"("launchGroupId", "platform");
