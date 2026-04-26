import "dotenv/config";
import fs from "node:fs/promises";
import { JobStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { assertSafeStoragePath, deleteInputImages } from "@/lib/storage";

async function removeFile(filePath: string | null) {
  if (!filePath) return;
  const safePath = assertSafeStoragePath(filePath);
  await fs.rm(safePath, { force: true });
}

async function main() {
  const now = new Date();
  const imageCutoff = new Date(now.getTime() - env.imageRetentionDays * 24 * 60 * 60 * 1000);
  const sessionResult = await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  console.log(`Deleted expired sessions: ${sessionResult.count}`);

  const expiredJobs = await prisma.imageJob.findMany({
    where: {
      status: JobStatus.COMPLETED,
      completedAt: { lt: imageCutoff },
      resultPath: { not: null },
      resultDeletedAt: null
    },
    take: 200
  });

  for (const job of expiredJobs) {
    await removeFile(job.resultPath);
    await removeFile(job.thumbnailPath);
    await deleteInputImages(job.inputImages);
    await prisma.imageJob.update({
      where: { id: job.id },
      data: { status: JobStatus.EXPIRED, resultDeletedAt: new Date() }
    });
    console.log(`Expired image: ${job.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
