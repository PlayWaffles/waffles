-- CreateEnum
CREATE TYPE "LeagueOutcome" AS ENUM ('PROMOTED', 'DEMOTED', 'STAYED');

-- AlterTable
ALTER TABLE "LeagueMember" ADD COLUMN     "cohortId" TEXT,
ADD COLUMN     "outcome" "LeagueOutcome";

-- CreateTable
CREATE TABLE "LeagueCohort" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" VARCHAR(20) NOT NULL,
    "index" SMALLINT NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "LeagueCohort_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeagueCohort_season_settledAt_idx" ON "LeagueCohort"("season", "settledAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueCohort_leagueId_season_index_key" ON "LeagueCohort"("leagueId", "season", "index");

-- CreateIndex
CREATE INDEX "LeagueMember_cohortId_points_idx" ON "LeagueMember"("cohortId", "points" DESC);

-- AddForeignKey
ALTER TABLE "LeagueCohort" ADD CONSTRAINT "LeagueCohort_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "LeagueCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
