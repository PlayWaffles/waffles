-- Rookie Cup: free intro tournament (Syrup reward only).

-- AlterEnum: new ledger reason for the rookie Syrup reward.
ALTER TYPE "TicketLedgerReason" ADD VALUE 'ROOKIE_REWARD';

-- AlterTable: rookie completion marker (gates one-per-user + "graduated").
ALTER TABLE "User" ADD COLUMN     "rookieCupAt" TIMESTAMP(3);
