-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'CREATE_FEATURE';
ALTER TYPE "Permission" ADD VALUE 'UPDATE_FEATURE';
ALTER TYPE "Permission" ADD VALUE 'DELETE_FEATURE';
ALTER TYPE "Permission" ADD VALUE 'VIEW_STATS';

-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "BugWorkflowStep" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugWorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BugWorkflowStepRelated" (
    "stepId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BugWorkflowStepRelated_pkey" PRIMARY KEY ("stepId","userId")
);

CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FeatureStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deleteReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeatureWorkflowStep" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureWorkflowStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FeatureWorkflowStepRelated" (
    "stepId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FeatureWorkflowStepRelated_pkey" PRIMARY KEY ("stepId","userId")
);

-- CreateIndex
CREATE INDEX "BugWorkflowStep_bugId_sortOrder_idx" ON "BugWorkflowStep"("bugId", "sortOrder");
CREATE INDEX "BugWorkflowStep_ownerId_idx" ON "BugWorkflowStep"("ownerId");
CREATE INDEX "BugWorkflowStepRelated_userId_idx" ON "BugWorkflowStepRelated"("userId");

CREATE INDEX "Feature_systemId_idx" ON "Feature"("systemId");
CREATE INDEX "Feature_creatorId_idx" ON "Feature"("creatorId");
CREATE INDEX "Feature_status_idx" ON "Feature"("status");
CREATE INDEX "Feature_deletedAt_idx" ON "Feature"("deletedAt");

CREATE INDEX "FeatureWorkflowStep_featureId_sortOrder_idx" ON "FeatureWorkflowStep"("featureId", "sortOrder");
CREATE INDEX "FeatureWorkflowStep_ownerId_idx" ON "FeatureWorkflowStep"("ownerId");
CREATE INDEX "FeatureWorkflowStepRelated_userId_idx" ON "FeatureWorkflowStepRelated"("userId");

-- AddForeignKey
ALTER TABLE "BugWorkflowStep" ADD CONSTRAINT "BugWorkflowStep_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BugWorkflowStep" ADD CONSTRAINT "BugWorkflowStep_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BugWorkflowStepRelated" ADD CONSTRAINT "BugWorkflowStepRelated_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "BugWorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BugWorkflowStepRelated" ADD CONSTRAINT "BugWorkflowStepRelated_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Feature" ADD CONSTRAINT "Feature_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "TrackedSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FeatureWorkflowStep" ADD CONSTRAINT "FeatureWorkflowStep_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureWorkflowStep" ADD CONSTRAINT "FeatureWorkflowStep_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeatureWorkflowStepRelated" ADD CONSTRAINT "FeatureWorkflowStepRelated_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "FeatureWorkflowStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureWorkflowStepRelated" ADD CONSTRAINT "FeatureWorkflowStepRelated_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
