-- CreateEnum
CREATE TYPE "BugActivityType" AS ENUM (
    'CREATED',
    'UPDATED',
    'STATUS_CHANGED',
    'SCREENSHOT_ADDED',
    'SCREENSHOT_REMOVED',
    'RUNTIME_INFO_ADDED',
    'RUNTIME_INFO_UPDATED',
    'RUNTIME_INFO_REMOVED',
    'RETEST_RECORDED'
);

-- CreateTable
CREATE TABLE "BugActivity" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "BugActivityType" NOT NULL,
    "note" TEXT,
    "fromStatus" "BugStatus",
    "toStatus" "BugStatus",
    "changes" JSONB,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugActivity_bugId_createdAt_idx" ON "BugActivity"("bugId", "createdAt");

-- CreateIndex
CREATE INDEX "BugActivity_actorId_idx" ON "BugActivity"("actorId");

-- CreateIndex
CREATE INDEX "BugActivity_type_idx" ON "BugActivity"("type");

-- AddForeignKey
ALTER TABLE "BugActivity" ADD CONSTRAINT "BugActivity_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugActivity" ADD CONSTRAINT "BugActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill current bugs with at least one created activity.
INSERT INTO "BugActivity" ("id", "bugId", "actorId", "type", "createdAt")
SELECT
    'legacy_created_' || "id",
    "id",
    "creatorId",
    'CREATED'::"BugActivityType",
    "createdAt"
FROM "Bug";

-- Backfill current fixed bugs with a synthetic status-change activity.
INSERT INTO "BugActivity" ("id", "bugId", "actorId", "type", "note", "fromStatus", "toStatus", "createdAt")
SELECT
    'legacy_fixed_' || "id",
    "id",
    COALESCE("fixedById", "creatorId"),
    'STATUS_CHANGED'::"BugActivityType",
    '历史数据迁移，原修复备注缺失',
    'OPEN'::"BugStatus",
    'FIXED'::"BugStatus",
    COALESCE("fixedAt", "updatedAt", "createdAt")
FROM "Bug"
WHERE "status" = 'FIXED';
