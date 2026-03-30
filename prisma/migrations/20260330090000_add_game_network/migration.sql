CREATE TYPE "GameNetwork" AS ENUM ('BASE_MAINNET', 'BASE_SEPOLIA', 'CELO_SEPOLIA');

ALTER TABLE "Game"
ADD COLUMN "network" "GameNetwork";

UPDATE "Game"
SET "network" = CASE
  WHEN "platform" = 'FARCASTER'::"UserPlatform" THEN 'BASE_SEPOLIA'::"GameNetwork"
  WHEN "platform" = 'MINIPAY'::"UserPlatform" THEN 'CELO_SEPOLIA'::"GameNetwork"
  ELSE 'BASE_MAINNET'::"GameNetwork"
END
WHERE "network" IS NULL;

ALTER TABLE "Game"
ALTER COLUMN "network" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Game_platform_network_startsAt_idx"
ON "Game"("platform", "network", "startsAt");
