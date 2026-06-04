-- CreateEnum
CREATE TYPE "FeatureActivityType" AS ENUM (
    'CREATED',
    'UPDATED',
    'STATUS_CHANGED',
    'DELETED',
    'OWNER_CLAIMED',
    'OWNER_DELEGATED',
    'OWNER_REVOKED',
    'RELATED_JOINED',
    'RELATED_ADDED',
    'RELATED_REMOVED'
);

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'DELETE_FEATURE_ACTIVITY';

-- CreateTable
CREATE TABLE "FeatureActivity" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "FeatureActivityType" NOT NULL,
    "note" TEXT,
    "fromStatus" "FeatureStatus",
    "toStatus" "FeatureStatus",
    "changes" JSONB,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureActivity_featureId_createdAt_idx" ON "FeatureActivity"("featureId", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureActivity_actorId_idx" ON "FeatureActivity"("actorId");

-- CreateIndex
CREATE INDEX "FeatureActivity_type_idx" ON "FeatureActivity"("type");

-- AddForeignKey
ALTER TABLE "FeatureActivity" ADD CONSTRAINT "FeatureActivity_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureActivity" ADD CONSTRAINT "FeatureActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill current features with at least one created activity.
INSERT INTO "FeatureActivity" ("id", "featureId", "actorId", "type", "createdAt")
SELECT
    'legacy_created_' || "id",
    "id",
    "creatorId",
    'CREATED'::"FeatureActivityType",
    "createdAt"
FROM "Feature";

-- Backfill completed features with a synthetic status-change activity.
INSERT INTO "FeatureActivity" ("id", "featureId", "actorId", "type", "note", "fromStatus", "toStatus", "createdAt")
SELECT
    'legacy_done_' || "id",
    "id",
    COALESCE("completedById", "creatorId"),
    'STATUS_CHANGED'::"FeatureActivityType",
    '历史数据迁移，原状态变更备注缺失',
    'PLANNED'::"FeatureStatus",
    'DONE'::"FeatureStatus",
    COALESCE("completedAt", "updatedAt", "createdAt")
FROM "Feature"
WHERE "status" = 'DONE';
