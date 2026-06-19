-- CreateEnum
-- The live v1 baseline already has "Difficulty" (its QuestionTemplate.difficulty
-- uses it) created outside the recorded migration prefix, so a plain CREATE TYPE
-- fails on v1→v2 deploy with "type already exists". Guard it: fresh DBs still get
-- it created; an existing identical enum is left as-is. (Values match v1 exactly.)
DO $$ BEGIN
  CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('SINGLE', 'MULTI', 'ORDER', 'SPATIAL');

-- CreateEnum
CREATE TYPE "LevelTrack" AS ENUM ('STANDARD', 'WORLD_CUP');

-- CreateEnum
CREATE TYPE "TicketLedgerReason" AS ENUM ('LEVEL_MILESTONE', 'TOURNAMENT_REWARD', 'TOURNAMENT_ENTRY', 'DAILY_REWARD', 'SHOP_PURCHASE', 'BUNDLE_TOPUP', 'LIVES_REFILL', 'WINNING_CONVERT', 'FIRST_TICKET_OFFER', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "WinningStatus" AS ENUM ('PENDING', 'CLAIMED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ShopItemKind" AS ENUM ('POWERUP', 'COSMETIC', 'BUNDLE', 'BOOST', 'FEATURED');

-- CreateEnum
CREATE TYPE "PowerUpKind" AS ENUM ('FIFTY_FIFTY', 'EXTRA_TIME', 'SKIP', 'SHIELD');

-- CreateEnum
CREATE TYPE "BoostKind" AS ENUM ('DOUBLE_XP');

-- CreateEnum
CREATE TYPE "CosmeticKind" AS ENUM ('AVATAR_FRAME', 'NAME_COLOR', 'EMOTE');

-- CreateEnum
CREATE TYPE "LeagueTier" AS ENUM ('APPRENTICE_1', 'APPRENTICE_2', 'SILVER_1', 'SILVER_2', 'SILVER_3', 'ADVANCED_1', 'ADVANCED_2', 'GENIUS', 'MASTER_3', 'MASTER_2', 'MASTER_1');

-- DropIndex
DROP INDEX "Game_platform_network_startsAt_idx";

-- DropIndex
DROP INDEX "User_onboardingCompletedAt_idx";

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "isTestnet" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketOpenNotifsSent" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ticketsOpenAt" TIMESTAMP(3),
ALTER COLUMN "tierPrices" SET DEFAULT ARRAY[1]::DOUBLE PRECISION[],
ALTER COLUMN "gameNumber" DROP DEFAULT;
DROP SEQUENCE "Game_gameNumber_seq";

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "clues" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "correctOrder" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "correctSet" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "kicker" VARCHAR(120),
ADD COLUMN     "kind" "QuestionKind" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN     "minefield" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pick" SMALLINT,
ADD COLUMN     "templateId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarId" VARCHAR(40),
ADD COLUMN     "lives" SMALLINT NOT NULL DEFAULT 5,
ADD COLUMN     "nextLifeAt" TIMESTAMP(3),
ADD COLUMN     "streakFreezes" SMALLINT NOT NULL DEFAULT 0,
ADD COLUMN     "ticketBalance" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QuestionTemplate" (
    "id" TEXT NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "options" TEXT[],
    "correctIndex" SMALLINT NOT NULL,
    "durationSec" SMALLINT NOT NULL DEFAULT 10,
    "kind" "QuestionKind" NOT NULL DEFAULT 'SINGLE',
    "correctSet" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "pick" SMALLINT,
    "correctOrder" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minefield" BOOLEAN NOT NULL DEFAULT false,
    "kicker" VARCHAR(120),
    "clues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaUrl" VARCHAR(255),
    "soundUrl" VARCHAR(255),
    "theme" "GameTheme" NOT NULL DEFAULT 'GENERAL',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "targetUrl" VARCHAR(1024) NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "userId" TEXT,
    "success" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "invalidTokens" INTEGER NOT NULL DEFAULT 0,
    "rateLimited" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "TicketLedgerReason" NOT NULL,
    "refId" VARCHAR(60),
    "note" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "track" "LevelTrack" NOT NULL,
    "level" SMALLINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" BIGINT NOT NULL,
    "score" INTEGER,
    "bonus" BOOLEAN NOT NULL DEFAULT false,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "finalRank" INTEGER,
    "reward" INTEGER,
    "resultReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "RoundEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winning" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" BIGINT,
    "rank" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "status" "WinningStatus" NOT NULL DEFAULT 'PENDING',
    "wonAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "claimTxHash" VARCHAR(66),
    "merkleProof" JSONB,
    "merkleAmount" VARCHAR(78),

    CONSTRAINT "Winning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "title" VARCHAR(140) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "ctaLabel" VARCHAR(60),
    "ctaAction" VARCHAR(120),
    "kind" VARCHAR(30) NOT NULL DEFAULT 'info',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "count" SMALLINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "tier" "LeagueTier" NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "color" VARCHAR(9) NOT NULL,
    "sortOrder" SMALLINT NOT NULL,
    "rewards" JSONB NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" VARCHAR(20) NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "kind" "ShopItemKind" NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "sub" VARCHAR(120),
    "priceTickets" INTEGER,
    "priceFiat" DOUBLE PRECISION,
    "payload" JSONB,
    "color" VARCHAR(9),
    "iconUrl" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" SMALLINT NOT NULL DEFAULT 1,
    "spentTickets" INTEGER NOT NULL DEFAULT 0,
    "spentFiat" DOUBLE PRECISION,
    "txHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerUpInventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PowerUpKind" NOT NULL,
    "count" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "PowerUpInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "kind" "CosmeticKind" NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBoost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "BoostKind" NOT NULL,
    "remainingCharges" SMALLINT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" VARCHAR(60) NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRewardClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayKey" VARCHAR(10) NOT NULL,
    "streak" SMALLINT NOT NULL DEFAULT 1,
    "reward" JSONB NOT NULL,
    "usedFreeze" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyRewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionTemplate_theme_difficulty_idx" ON "QuestionTemplate"("theme", "difficulty");

-- CreateIndex
CREATE INDEX "QuestionTemplate_createdAt_idx" ON "QuestionTemplate"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuestionTemplate_usageCount_idx" ON "QuestionTemplate"("usageCount" DESC);

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "TicketLedger_userId_createdAt_idx" ON "TicketLedger"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LevelProgress_userId_track_key" ON "LevelProgress"("userId", "track");

-- CreateIndex
CREATE INDEX "RoundEntry_roundId_score_idx" ON "RoundEntry"("roundId", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RoundEntry_userId_roundId_key" ON "RoundEntry"("userId", "roundId");

-- CreateIndex
CREATE INDEX "Winning_userId_wonAt_idx" ON "Winning"("userId", "wonAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_slug_key" ON "Announcement"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementState_userId_announcementId_key" ON "AnnouncementState"("userId", "announcementId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_userId_questId_key" ON "QuestProgress"("userId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "League_tier_key" ON "League"("tier");

-- CreateIndex
CREATE INDEX "LeagueMember_season_points_idx" ON "LeagueMember"("season", "points" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_userId_season_key" ON "LeagueMember"("userId", "season");

-- CreateIndex
CREATE UNIQUE INDEX "ShopItem_slug_key" ON "ShopItem"("slug");

-- CreateIndex
CREATE INDEX "Purchase_userId_createdAt_idx" ON "Purchase"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PowerUpInventory_userId_kind_key" ON "PowerUpInventory"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_slug_key" ON "UserCosmetic"("userId", "slug");

-- CreateIndex
CREATE INDEX "UserBoost_userId_idx" ON "UserBoost"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRewardClaim_userId_dayKey_key" ON "DailyRewardClaim"("userId", "dayKey");

-- CreateIndex
CREATE INDEX "Question_templateId_idx" ON "Question"("templateId");

-- AddForeignKey
ALTER TABLE "TicketLedger" ADD CONSTRAINT "TicketLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelProgress" ADD CONSTRAINT "LevelProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundEntry" ADD CONSTRAINT "RoundEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winning" ADD CONSTRAINT "Winning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementState" ADD CONSTRAINT "AnnouncementState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementState" ADD CONSTRAINT "AnnouncementState_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowerUpInventory" ADD CONSTRAINT "PowerUpInventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBoost" ADD CONSTRAINT "UserBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRewardClaim" ADD CONSTRAINT "DailyRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
