-- Daily-mission generation: `eventType` is the gameplay signal that advances a
-- mission (so progress is recorded per event, not per slug); `featured` pins the
-- fixed home dailies, while unfeatured active ENGAGEMENT/DAILY quests form the
-- rotating generated pool. Both additive + nullable/defaulted — safe.
ALTER TABLE "Quest" ADD COLUMN "eventType" VARCHAR(40);
ALTER TABLE "Quest" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
