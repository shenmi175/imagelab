ALTER TABLE "ImageJob"
ADD COLUMN "outputCompression" INTEGER,
ADD COLUMN "background" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN "moderation" TEXT NOT NULL DEFAULT 'auto';
