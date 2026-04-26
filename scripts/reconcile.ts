import "dotenv/config";
import { JobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureQueued } from "@/lib/queue";

async function main() {
  const queued = await prisma.imageJob.findMany({ where: { status: JobStatus.QUEUED } });
  for (const job of queued) {
    await ensureQueued(job.id);
    console.log(`Ensured queued: ${job.id}`);
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
