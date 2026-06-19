-- Per-question play stats, tracked SEPARATELY per mode ("tournament" | "level").
-- One row per (template, mode); counters incremented once per completed play.
CREATE TABLE "QuestionStat" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "mode" VARCHAR(16) NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "totalResponseMs" BIGINT NOT NULL DEFAULT 0,
    "lastPlayedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestionStat_templateId_mode_key" ON "QuestionStat"("templateId", "mode");
CREATE INDEX "QuestionStat_mode_idx" ON "QuestionStat"("mode");

ALTER TABLE "QuestionStat" ADD CONSTRAINT "QuestionStat_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuestionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
