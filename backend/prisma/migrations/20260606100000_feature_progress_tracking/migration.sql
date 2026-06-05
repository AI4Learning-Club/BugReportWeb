-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'ADD_FEATURE_EVIDENCE';

-- CreateEnum
CREATE TYPE "ImplementationItemStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- AlterEnum (FeatureActivityType extensions)
ALTER TYPE "FeatureActivityType" ADD VALUE 'SCREENSHOT_ADDED';
ALTER TYPE "FeatureActivityType" ADD VALUE 'SCREENSHOT_REMOVED';
ALTER TYPE "FeatureActivityType" ADD VALUE 'IMPLEMENTATION_ITEM_ADDED';
ALTER TYPE "FeatureActivityType" ADD VALUE 'IMPLEMENTATION_ITEM_UPDATED';
ALTER TYPE "FeatureActivityType" ADD VALUE 'IMPLEMENTATION_ITEM_REMOVED';
ALTER TYPE "FeatureActivityType" ADD VALUE 'IMPLEMENTATION_ITEM_STATUS_CHANGED';

-- AlterTable
ALTER TABLE "Feature" ADD COLUMN "plannedStartAt" TIMESTAMP(3),
ADD COLUMN "plannedEndAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FeatureScreenshot" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureImplementationItem" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "status" "ImplementationItemStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "plannedStartAt" TIMESTAMP(3),
    "plannedEndAt" TIMESTAMP(3),
    "actualStartAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureImplementationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feature_plannedStartAt_idx" ON "Feature"("plannedStartAt");
CREATE INDEX "Feature_plannedEndAt_idx" ON "Feature"("plannedEndAt");
CREATE INDEX "FeatureScreenshot_featureId_idx" ON "FeatureScreenshot"("featureId");
CREATE INDEX "FeatureImplementationItem_featureId_sortOrder_idx" ON "FeatureImplementationItem"("featureId", "sortOrder");
CREATE INDEX "FeatureImplementationItem_featureId_plannedStartAt_idx" ON "FeatureImplementationItem"("featureId", "plannedStartAt");
CREATE INDEX "FeatureImplementationItem_ownerId_idx" ON "FeatureImplementationItem"("ownerId");

-- AddForeignKey
ALTER TABLE "FeatureScreenshot" ADD CONSTRAINT "FeatureScreenshot_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureScreenshot" ADD CONSTRAINT "FeatureScreenshot_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FeatureImplementationItem" ADD CONSTRAINT "FeatureImplementationItem_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureImplementationItem" ADD CONSTRAINT "FeatureImplementationItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
