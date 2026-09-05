-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mfaBackupCodes" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "mfaEnabledAt" TIMESTAMP(3),
ADD COLUMN     "mfaPendingSecret" TEXT,
ADD COLUMN     "mfaSecret" TEXT;
