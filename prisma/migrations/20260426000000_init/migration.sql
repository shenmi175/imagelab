CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "JobStatus" AS ENUM ('PENDING_ENQUEUE', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED', 'EXPIRED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

CREATE TABLE "User" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "dailyQuota" INTEGER NOT NULL DEFAULT 3,
  "isDisabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3),
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InviteCode" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "usedById" INTEGER,
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER,
  CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImageJob" (
  "id" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "model" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "quality" TEXT NOT NULL,
  "outputFormat" TEXT NOT NULL,
  "status" "JobStatus" NOT NULL DEFAULT 'PENDING_ENQUEUE',
  "queueJobId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "workerId" TEXT,
  "lockedAt" TIMESTAMP(3),
  "lockExpiresAt" TIMESTAMP(3),
  "resultPath" TEXT,
  "resultMime" TEXT,
  "resultBytes" INTEGER,
  "resultDeletedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "upstreamStatus" INTEGER,
  "upstreamRequestId" TEXT,
  "quotaDate" TEXT NOT NULL,
  "quotaCharged" BOOLEAN NOT NULL DEFAULT true,
  "quotaRefundedAt" TIMESTAMP(3),
  "requestIpHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "queuedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ImageJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueueOutbox" (
  "id" TEXT NOT NULL,
  "imageJobId" TEXT NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QueueOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageLog" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "imageJobId" TEXT,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");
CREATE INDEX "InviteCode_usedById_idx" ON "InviteCode"("usedById");
CREATE INDEX "InviteCode_expiresAt_idx" ON "InviteCode"("expiresAt");
CREATE UNIQUE INDEX "ImageJob_queueJobId_key" ON "ImageJob"("queueJobId");
CREATE INDEX "ImageJob_userId_createdAt_idx" ON "ImageJob"("userId", "createdAt");
CREATE INDEX "ImageJob_userId_status_idx" ON "ImageJob"("userId", "status");
CREATE INDEX "ImageJob_status_createdAt_idx" ON "ImageJob"("status", "createdAt");
CREATE INDEX "ImageJob_status_lockExpiresAt_idx" ON "ImageJob"("status", "lockExpiresAt");
CREATE INDEX "ImageJob_quotaDate_userId_idx" ON "ImageJob"("quotaDate", "userId");
CREATE UNIQUE INDEX "QueueOutbox_imageJobId_key" ON "QueueOutbox"("imageJobId");
CREATE INDEX "QueueOutbox_status_nextRunAt_idx" ON "QueueOutbox"("status", "nextRunAt");
CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");
CREATE INDEX "UsageLog_imageJobId_idx" ON "UsageLog"("imageJobId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageJob" ADD CONSTRAINT "ImageJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QueueOutbox" ADD CONSTRAINT "QueueOutbox_imageJobId_fkey" FOREIGN KEY ("imageJobId") REFERENCES "ImageJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_imageJobId_fkey" FOREIGN KEY ("imageJobId") REFERENCES "ImageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
