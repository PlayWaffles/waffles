ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE INDEX "User_onboardingCompletedAt_idx" ON "User"("onboardingCompletedAt");
