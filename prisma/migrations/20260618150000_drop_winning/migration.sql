-- Consolidate the Prize Wallet onto GameEntry + the merkle claim path.
-- Drops the unused parallel Winning table (no write path; prizes live on
-- GameEntry). Convert-to-Syrup is deferred until the contract supports it.

-- DropTable
DROP TABLE "Winning";

-- DropEnum
DROP TYPE "WinningStatus";
