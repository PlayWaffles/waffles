CREATE TABLE "LevelQuestionExposure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "track" "LevelTrack" NOT NULL,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLevel" SMALLINT NOT NULL,

    CONSTRAINT "LevelQuestionExposure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LevelQuestionExposure_userId_track_templateId_key" ON "LevelQuestionExposure"("userId", "track", "templateId");
CREATE INDEX "LevelQuestionExposure_userId_track_lastSeenAt_idx" ON "LevelQuestionExposure"("userId", "track", "lastSeenAt" DESC);
CREATE INDEX "LevelQuestionExposure_templateId_idx" ON "LevelQuestionExposure"("templateId");

ALTER TABLE "LevelQuestionExposure" ADD CONSTRAINT "LevelQuestionExposure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LevelQuestionExposure" ADD CONSTRAINT "LevelQuestionExposure_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuestionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
