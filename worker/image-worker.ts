import "dotenv/config";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { JobStatus, OutboxStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { ImageGenerationPayload, enqueuePendingJob, ensureQueued } from "@/lib/queue";
import { parseStoredInputImages, readImageFile, saveImageFile, saveThumbnailFile } from "@/lib/storage";
import { GenerationError, classifyUpstreamError } from "@/lib/upstream-errors";

const workerId = `${os.hostname()}-${process.pid}-${randomUUID()}`;

function datePlusSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimJob(imageJobId: string) {
  const now = new Date();
  const claimed = await prisma.imageJob.updateMany({
    where: { id: imageJobId, status: JobStatus.QUEUED },
    data: {
      status: JobStatus.RUNNING,
      attempts: { increment: 1 },
      workerId,
      lockedAt: now,
      lockExpiresAt: datePlusSeconds(env.jobLockSeconds),
      startedAt: now
    }
  });

  if (claimed.count !== 1) return null;
  return prisma.imageJob.findUnique({ where: { id: imageJobId } });
}

function toGenerationError(error: unknown) {
  if (error instanceof GenerationError) return error;
  if (error instanceof Error && error.name === "TimeoutError") {
    return new GenerationError("UPSTREAM_TIMEOUT", error.message, true, undefined, null, true);
  }
  if (error instanceof Error) {
    return new GenerationError("NETWORK_ERROR", error.message, true, undefined, null, true);
  }
  return new GenerationError("GENERATION_FAILED", String(error), false);
}

async function handleJobFailure(job: NonNullable<Awaited<ReturnType<typeof claimJob>>>, error: unknown) {
  const generationError = toGenerationError(error);
  const canRetry = generationError.retryable && job.attempts < env.maxJobAttempts;
  const now = new Date();

  if (canRetry) {
    await prisma.imageJob.updateMany({
      where: { id: job.id, status: JobStatus.RUNNING, workerId },
      data: {
        status: JobStatus.QUEUED,
        errorCode: generationError.code,
        errorMessage: generationError.message.slice(0, 2000),
        upstreamStatus: generationError.upstreamStatus,
        upstreamRequestId: generationError.upstreamRequestId ?? undefined,
        workerId: null,
        lockedAt: null,
        lockExpiresAt: null
      }
    });
    return;
  }

  await prisma.imageJob.updateMany({
    where: { id: job.id, status: JobStatus.RUNNING, workerId },
    data: {
      status: JobStatus.FAILED,
      errorCode: generationError.code,
      errorMessage: generationError.message.slice(0, 2000),
      upstreamStatus: generationError.upstreamStatus,
      upstreamRequestId: generationError.upstreamRequestId ?? undefined,
      completedAt: now,
      quotaRefundedAt: generationError.refundQuota ? now : undefined,
      workerId: null,
      lockedAt: null,
      lockExpiresAt: null
    }
  });

  await prisma.usageLog.create({
    data: { userId: job.userId, imageJobId: job.id, action: "GENERATE", status: "FAILED", detail: generationError.code }
  });
}

async function processImageJob(payload: ImageGenerationPayload) {
  const job = await claimJob(payload.imageJobId);
  if (!job) return;

  try {
    const inputImages = parseStoredInputImages(job.inputImages);
    let response: Response;

    if (inputImages.length) {
      const formData = new FormData();
      formData.set("model", job.model);
      formData.set("prompt", job.prompt);
      formData.set("size", job.size);
      formData.set("quality", job.quality);
      formData.set("output_format", job.outputFormat);

      for (const image of inputImages) {
        const buffer = await readImageFile(image.path);
        formData.append("image[]", new Blob([new Uint8Array(buffer)], { type: image.mime }), image.name);
      }

      response = await fetch(`${env.sub2apiBaseUrl}/v1/images/edits`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.sub2apiApiKey}`
        },
        body: formData,
        signal: AbortSignal.timeout(env.upstreamTimeoutSeconds * 1000)
      });
    } else {
      response = await fetch(`${env.sub2apiBaseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.sub2apiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: job.model,
          prompt: job.prompt,
          size: job.size,
          quality: job.quality,
          output_format: job.outputFormat
        }),
        signal: AbortSignal.timeout(env.upstreamTimeoutSeconds * 1000)
      });
    }

    const text = await response.text();
    const upstreamRequestId = response.headers.get("x-request-id");

    if (!response.ok) {
      throw classifyUpstreamError(response.status, text, upstreamRequestId);
    }

    const json = JSON.parse(text) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      throw new GenerationError("INVALID_UPSTREAM_RESPONSE", `Missing data[0].b64_json: ${text.slice(0, 1000)}`, false);
    }

    const buffer = Buffer.from(b64, "base64");
    const filePath = await saveImageFile(job.id, buffer, job.outputFormat);
    const thumbnail = await saveThumbnailFile(job.id, buffer).catch((error) => {
      console.warn("Failed to create thumbnail for job", job.id, error);
      return null;
    });
    const completedAt = new Date();

    await prisma.imageJob.updateMany({
      where: { id: job.id, status: JobStatus.RUNNING, workerId },
      data: {
        status: JobStatus.COMPLETED,
        resultPath: filePath,
        resultMime: "image/png",
        resultBytes: buffer.length,
        thumbnailPath: thumbnail?.path,
        thumbnailMime: thumbnail?.mime,
        thumbnailBytes: thumbnail?.bytes,
        upstreamRequestId,
        completedAt,
        workerId: null,
        lockedAt: null,
        lockExpiresAt: null
      }
    });

    await prisma.usageLog.create({
      data: { userId: job.userId, imageJobId: job.id, action: "GENERATE", status: "COMPLETED" }
    });
  } catch (error) {
    await handleJobFailure(job, error);
  }
}

async function dispatchOutboxOnce() {
  const items = await prisma.queueOutbox.findMany({
    where: { status: OutboxStatus.PENDING, nextRunAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: 20
  });

  for (const item of items) {
    try {
      await prisma.queueOutbox.update({
        where: { id: item.id },
        data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 } }
      });
      await enqueuePendingJob(item.imageJobId);
    } catch (error) {
      const attempts = item.attempts + 1;
      const shouldFail = attempts >= 10;
      await prisma.queueOutbox.updateMany({
        where: { id: item.id },
        data: {
          status: shouldFail ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
          nextRunAt: datePlusSeconds(Math.min(300, 2 ** attempts))
        }
      });
      if (shouldFail) {
        await prisma.imageJob.updateMany({
          where: { id: item.imageJobId, status: JobStatus.PENDING_ENQUEUE },
          data: {
            status: JobStatus.FAILED,
            errorCode: "QUEUE_ENQUEUE_FAILED",
            errorMessage: "任务入队失败，请稍后重试",
            completedAt: new Date(),
            quotaRefundedAt: new Date()
          }
        });
      }
    }
  }
}

async function reconcileOnce() {
  const missingOutbox = await prisma.imageJob.findMany({
    where: { status: JobStatus.PENDING_ENQUEUE, outbox: null },
    take: 50
  });
  for (const job of missingOutbox) {
    await prisma.queueOutbox.create({ data: { imageJobId: job.id } }).catch(() => undefined);
  }

  const queued = await prisma.imageJob.findMany({
    where: { status: JobStatus.QUEUED },
    take: 50
  });
  for (const job of queued) {
    await ensureQueued(job.id).catch((error) => console.warn("Failed to ensure queued job", job.id, error));
  }

  const staleRunning = await prisma.imageJob.findMany({
    where: {
      status: JobStatus.RUNNING,
      lockExpiresAt: { lt: new Date(Date.now() - env.runningJobStaleSeconds * 1000) }
    },
    take: 50
  });

  for (const job of staleRunning) {
    if (job.attempts < env.maxJobAttempts) {
      await prisma.imageJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.QUEUED,
          workerId: null,
          lockedAt: null,
          lockExpiresAt: null,
          errorCode: "WORKER_STALE",
          errorMessage: "Worker stopped before finishing the job"
        }
      });
      await ensureQueued(job.id).catch((error) => console.warn("Failed to requeue stale job", job.id, error));
    } else {
      await prisma.imageJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          workerId: null,
          lockedAt: null,
          lockExpiresAt: null,
          completedAt: new Date(),
          errorCode: "WORKER_STALE",
          errorMessage: "Worker stopped and retry limit was reached",
          quotaRefundedAt: new Date()
        }
      });
    }
  }
}

async function heartbeatLoop() {
  const redis = getRedis();
  while (true) {
    await redis.set(`image-site:worker:${workerId}:heartbeat`, new Date().toISOString(), "EX", 90).catch(() => undefined);
    await sleep(30_000);
  }
}

async function intervalLoop(name: string, seconds: number, fn: () => Promise<void>) {
  while (true) {
    try {
      await fn();
    } catch (error) {
      console.error(`${name} failed`, error);
    }
    await sleep(seconds * 1000);
  }
}

console.log(`Starting image worker ${workerId} with concurrency ${env.maxGlobalConcurrency}`);

new Worker<ImageGenerationPayload>(env.queueName, async (job) => processImageJob(job.data), {
  connection: getRedis(),
  concurrency: env.maxGlobalConcurrency
});

void heartbeatLoop();
void intervalLoop("outbox dispatcher", env.outboxDispatchIntervalSeconds, dispatchOutboxOnce);
void intervalLoop("reconciler", env.reconcileIntervalSeconds, reconcileOnce);
