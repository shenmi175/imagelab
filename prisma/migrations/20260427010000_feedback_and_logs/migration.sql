CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'IGNORED');

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "imageJobId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "contact" TEXT,
  "pageUrl" TEXT,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
  "adminNote" TEXT,
  "requestIpHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
CREATE INDEX "Feedback_imageJobId_idx" ON "Feedback"("imageJobId");

ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_imageJobId_fkey" FOREIGN KEY ("imageJobId") REFERENCES "ImageJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
