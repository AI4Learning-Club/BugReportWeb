-- AlterEnum
ALTER TYPE "BugActivityType" ADD VALUE 'DELETED';

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'DELETE_BUG';

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "Bug_deletedAt_idx" ON "Bug"("deletedAt");

-- CreateIndex
CREATE INDEX "Bug_deletedById_idx" ON "Bug"("deletedById");

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
