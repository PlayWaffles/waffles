ALTER TABLE "QuestionTemplate" ADD COLUMN "factKey" VARCHAR(160);
UPDATE "QuestionTemplate" SET "factKey" = "id" WHERE "factKey" IS NULL;
ALTER TABLE "QuestionTemplate" ALTER COLUMN "factKey" SET NOT NULL;

ALTER TABLE "LevelQuestionExposure" ADD COLUMN "factKey" VARCHAR(160);
UPDATE "LevelQuestionExposure" e
SET "factKey" = q."factKey"
FROM "QuestionTemplate" q
WHERE e."templateId" = q."id" AND e."factKey" IS NULL;
UPDATE "LevelQuestionExposure" SET "factKey" = "templateId" WHERE "factKey" IS NULL;

DELETE FROM "LevelQuestionExposure" e
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "userId", track, "factKey"
        ORDER BY "lastSeenAt" DESC, "seenCount" DESC, id
      ) AS rn
    FROM "LevelQuestionExposure"
  ) ranked
  WHERE ranked.rn > 1
) duplicates
WHERE e.id = duplicates.id;

ALTER TABLE "LevelQuestionExposure" ALTER COLUMN "factKey" SET NOT NULL;

CREATE INDEX "QuestionTemplate_factKey_idx" ON "QuestionTemplate"("factKey");
CREATE UNIQUE INDEX "LevelQuestionExposure_userId_track_factKey_key" ON "LevelQuestionExposure"("userId", "track", "factKey");
CREATE INDEX "LevelQuestionExposure_factKey_idx" ON "LevelQuestionExposure"("factKey");
