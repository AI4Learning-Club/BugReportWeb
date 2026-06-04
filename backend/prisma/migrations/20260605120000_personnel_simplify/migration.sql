-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'BECOME_ITEM_OWNER';
ALTER TYPE "Permission" ADD VALUE 'DELEGATE_ITEM_RELATED';
ALTER TYPE "Permission" ADD VALUE 'DELEGATE_ITEM_OWNER';

-- Add ownerId to Bug and Feature
ALTER TABLE "Bug" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Feature" ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Bug_ownerId_idx" ON "Bug"("ownerId");
CREATE INDEX "Feature_ownerId_idx" ON "Feature"("ownerId");

ALTER TABLE "Bug" ADD CONSTRAINT "Bug_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create related user tables
CREATE TABLE "BugRelatedUser" (
    "bugId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "BugRelatedUser_pkey" PRIMARY KEY ("bugId","userId")
);

CREATE TABLE "FeatureRelatedUser" (
    "featureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "FeatureRelatedUser_pkey" PRIMARY KEY ("featureId","userId")
);

CREATE INDEX "BugRelatedUser_userId_idx" ON "BugRelatedUser"("userId");
CREATE INDEX "FeatureRelatedUser_userId_idx" ON "FeatureRelatedUser"("userId");

ALTER TABLE "BugRelatedUser" ADD CONSTRAINT "BugRelatedUser_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BugRelatedUser" ADD CONSTRAINT "BugRelatedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeatureRelatedUser" ADD CONSTRAINT "FeatureRelatedUser_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FeatureRelatedUser" ADD CONSTRAINT "FeatureRelatedUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate owner from first workflow step with an owner
UPDATE "Bug" b
SET "ownerId" = sub."ownerId"
FROM (
    SELECT DISTINCT ON (s."bugId") s."bugId", s."ownerId"
    FROM "BugWorkflowStep" s
    WHERE s."ownerId" IS NOT NULL
    ORDER BY s."bugId", s."sortOrder" ASC
) sub
WHERE b.id = sub."bugId";

UPDATE "Feature" f
SET "ownerId" = sub."ownerId"
FROM (
    SELECT DISTINCT ON (s."featureId") s."featureId", s."ownerId"
    FROM "FeatureWorkflowStep" s
    WHERE s."ownerId" IS NOT NULL
    ORDER BY s."featureId", s."sortOrder" ASC
) sub
WHERE f.id = sub."featureId";

-- Migrate related users (exclude entity owner)
INSERT INTO "BugRelatedUser" ("bugId", "userId")
SELECT DISTINCT s."bugId", r."userId"
FROM "BugWorkflowStepRelated" r
JOIN "BugWorkflowStep" s ON s."id" = r."stepId"
JOIN "Bug" b ON b."id" = s."bugId"
WHERE b."ownerId" IS NULL OR r."userId" <> b."ownerId"
ON CONFLICT DO NOTHING;

INSERT INTO "FeatureRelatedUser" ("featureId", "userId")
SELECT DISTINCT s."featureId", r."userId"
FROM "FeatureWorkflowStepRelated" r
JOIN "FeatureWorkflowStep" s ON s."id" = r."stepId"
JOIN "Feature" f ON f."id" = s."featureId"
WHERE f."ownerId" IS NULL OR r."userId" <> f."ownerId"
ON CONFLICT DO NOTHING;

-- Drop workflow tables
DROP TABLE "BugWorkflowStepRelated";
DROP TABLE "BugWorkflowStep";
DROP TABLE "FeatureWorkflowStepRelated";
DROP TABLE "FeatureWorkflowStep";
