ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "ImageJob" DROP CONSTRAINT IF EXISTS "ImageJob_userId_fkey";
ALTER TABLE "UsageLog" DROP CONSTRAINT IF EXISTS "UsageLog_userId_fkey";

DROP TABLE IF EXISTS "Session";

ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "image" TEXT;
ALTER TABLE "User" ADD COLUMN "id_new" TEXT;
UPDATE "User" SET "name" = "email" WHERE "name" IS NULL;
UPDATE "User" SET "id_new" = "id"::TEXT;
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "ImageJob" ADD COLUMN "userId_new" TEXT;
UPDATE "ImageJob" SET "userId_new" = "userId"::TEXT;
ALTER TABLE "UsageLog" ADD COLUMN "userId_new" TEXT;
UPDATE "UsageLog" SET "userId_new" = "userId"::TEXT;
ALTER TABLE "InviteCode" ADD COLUMN "usedById_new" TEXT;
ALTER TABLE "InviteCode" ADD COLUMN "createdById_new" TEXT;
UPDATE "InviteCode" SET "usedById_new" = "usedById"::TEXT WHERE "usedById" IS NOT NULL;
UPDATE "InviteCode" SET "createdById_new" = "createdById"::TEXT WHERE "createdById" IS NOT NULL;

DROP INDEX IF EXISTS "ImageJob_userId_createdAt_idx";
DROP INDEX IF EXISTS "ImageJob_userId_status_idx";
DROP INDEX IF EXISTS "ImageJob_quotaDate_userId_idx";
DROP INDEX IF EXISTS "UsageLog_userId_createdAt_idx";
DROP INDEX IF EXISTS "InviteCode_usedById_idx";

ALTER TABLE "User" DROP CONSTRAINT "User_pkey";
ALTER TABLE "User" DROP COLUMN "id";
ALTER TABLE "User" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

ALTER TABLE "ImageJob" DROP COLUMN "userId";
ALTER TABLE "ImageJob" RENAME COLUMN "userId_new" TO "userId";
ALTER TABLE "ImageJob" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "UsageLog" DROP COLUMN "userId";
ALTER TABLE "UsageLog" RENAME COLUMN "userId_new" TO "userId";
ALTER TABLE "UsageLog" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "InviteCode" DROP COLUMN "usedById";
ALTER TABLE "InviteCode" RENAME COLUMN "usedById_new" TO "usedById";
ALTER TABLE "InviteCode" DROP COLUMN "createdById";
ALTER TABLE "InviteCode" RENAME COLUMN "createdById_new" TO "createdById";

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Account" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
SELECT 'credential_' || "id", "id", 'credential', "id", "passwordHash", "createdAt", CURRENT_TIMESTAMP
FROM "User"
WHERE "passwordHash" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "User" DROP COLUMN "passwordHash";

CREATE TABLE "Verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
CREATE INDEX "ImageJob_userId_createdAt_idx" ON "ImageJob"("userId", "createdAt");
CREATE INDEX "ImageJob_userId_status_idx" ON "ImageJob"("userId", "status");
CREATE INDEX "ImageJob_quotaDate_userId_idx" ON "ImageJob"("quotaDate", "userId");
CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");
CREATE INDEX "InviteCode_usedById_idx" ON "InviteCode"("usedById");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageJob" ADD CONSTRAINT "ImageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
