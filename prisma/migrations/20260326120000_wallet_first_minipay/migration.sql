BEGIN;

DO $$
BEGIN
  CREATE TYPE "UserPlatform" AS ENUM ('FARCASTER', 'MINIPAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "platform" "UserPlatform";

ALTER TABLE "User"
ALTER COLUMN "fid" DROP NOT NULL;

UPDATE "User"
SET "wallet" = lower("wallet")
WHERE "wallet" IS NOT NULL;

-- Existing FID users remain Farcaster users.
UPDATE "User"
SET "platform" = 'FARCASTER'::"UserPlatform"
WHERE "platform" IS NULL
  AND "fid" IS NOT NULL;

-- Wallet-only users become MiniPay users.
UPDATE "User"
SET "platform" = 'MINIPAY'::"UserPlatform"
WHERE "platform" IS NULL
  AND "fid" IS NULL
  AND "wallet" IS NOT NULL;

-- Fallback for unexpected legacy rows. These should be reviewed manually later.
UPDATE "User"
SET "platform" = 'FARCASTER'::"UserPlatform"
WHERE "platform" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "platform" SET NOT NULL;

ALTER TABLE "User"
ADD CONSTRAINT "User_platform_identity_required"
CHECK (
  ("platform" = 'FARCASTER'::"UserPlatform" AND "fid" IS NOT NULL)
  OR
  ("platform" = 'MINIPAY'::"UserPlatform" AND "wallet" IS NOT NULL)
) NOT VALID;

COMMIT;
