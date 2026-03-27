BEGIN;

ALTER TABLE "Game"
ADD COLUMN IF NOT EXISTS "platform" "UserPlatform";

UPDATE "Game"
SET "platform" = 'FARCASTER'::"UserPlatform"
WHERE "platform" IS NULL;

ALTER TABLE "Game"
ALTER COLUMN "platform" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Game_platform_startsAt_idx"
ON "Game"("platform", "startsAt");

CREATE INDEX IF NOT EXISTS "Game_platform_endsAt_idx"
ON "Game"("platform", "endsAt");

COMMIT;
