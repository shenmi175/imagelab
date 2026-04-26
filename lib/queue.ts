import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export type ImageGenerationPayload = {
  imageJobId: string;
};

const globalForQueue = globalThis as unknown as { imageQueue?: Queue<ImageGenerationPayload> };

export function getImageQueue() {
  if (!globalForQueue.imageQueue) {
    globalForQueue.imageQueue = new Queue<ImageGenerationPayload>(env.queueName, {
      connection: getRedis()
    });
  }
  return globalForQueue.imageQueue;
}

export function imageJobOptions(imageJobId: string): JobsOptions {
  return {
    jobId: imageJobId,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true
  };
}

export async function enqueuePendingJob(imageJobId: string) {
  const job = await prisma.imageJob.findUnique({ where: { id: imageJobId } });
  if (!job || !["PENDING_ENQUEUE", "QUEUED"].includes(job.status)) return;

  const queue = getImageQueue();
  await queue.add("generate", { imageJobId }, imageJobOptions(imageJobId));

  await prisma.$transaction(async (tx) => {
    await tx.imageJob.updateMany({
      where: { id: imageJobId, status: "PENDING_ENQUEUE" },
      data: { status: "QUEUED", queueJobId: imageJobId, queuedAt: new Date() }
    });
    await tx.queueOutbox.deleteMany({ where: { imageJobId } });
  });
}

export async function ensureQueued(imageJobId: string) {
  const queue = getImageQueue();
  const existing = await queue.getJob(imageJobId);
  if (!existing) {
    await queue.add("generate", { imageJobId }, imageJobOptions(imageJobId));
  }
}
