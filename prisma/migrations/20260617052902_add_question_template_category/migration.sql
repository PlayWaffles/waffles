-- AlterTable
ALTER TABLE "QuestionTemplate" ADD COLUMN     "category" VARCHAR(40);

-- CreateIndex
CREATE INDEX "QuestionTemplate_category_idx" ON "QuestionTemplate"("category");
