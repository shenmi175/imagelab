import crypto from "node:crypto";
import { JobStatus, UserRole } from "@prisma/client";
import { env } from "@/lib/env";
import { ApiError, requestIpHash, requestUserAgent } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { quotaDate } from "@/lib/time";
import { enqueuePendingJob } from "@/lib/queue";
import { jobDurations } from "@/lib/duration";
import { friendlyErrorMessage, statusLabel } from "@/lib/status-labels";
import { deleteInputImages, parseStoredInputImages, saveInputImageFile, type StoredInputImage } from "@/lib/storage";

const GLOBAL_QUEUE_LOCK = 10001;
const USER_LOCK_BASE = 20000;
const MAX_INPUT_IMAGES = 4;

export type PendingInputImage = {
  buffer: Buffer;
  mime?: string;
  name?: string;
};

export function imageUrls(job: { id: string; status: JobStatus; resultDeletedAt: Date | null }) {
  if (job.status !== JobStatus.COMPLETED || job.resultDeletedAt) {
    return { imageUrl: null, downloadUrl: null };
  }
  return {
    imageUrl: `/api/image-jobs/${job.id}/image`,
    downloadUrl: `/api/image-jobs/${job.id}/download`
  };
}

export async function createImageJob(input: {
  user: { id: string; role: UserRole; dailyQuota: number; isDisabled: boolean };
  prompt: string;
  size: string;
  quality: string;
  inputImages?: PendingInputImage[];
}) {
  if (input.user.isDisabled) throw new ApiError("USER_DISABLED", "账号已被禁用", 403);
  if (input.inputImages && input.inputImages.length > MAX_INPUT_IMAGES) {
    throw new ApiError("INVALID_INPUT", `最多上传 ${MAX_INPUT_IMAGES} 张参考图`);
  }

  const currentQuotaDate = quotaDate();
  const ipHash = await requestIpHash();
  const userAgent = await requestUserAgent();
  const jobId = crypto.randomUUID();
  const storedInputImages: StoredInputImage[] = [];

  try {
    for (let index = 0; index < (input.inputImages?.length ?? 0); index += 1) {
      const image = input.inputImages![index];
      storedInputImages.push(
        await saveInputImageFile({
          jobId,
          index,
          buffer: image.buffer,
          mime: image.mime,
          name: image.name
        })
      );
    }
  } catch (error) {
    await deleteInputImages(storedInputImages);
    throw error;
  }

  let imageJob;
  try {
    imageJob = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GLOBAL_QUEUE_LOCK})`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${USER_LOCK_BASE}::integer, hashtext(${input.user.id}))`;

      const user = await tx.user.findUnique({ where: { id: input.user.id } });
      if (!user) throw new ApiError("UNAUTHORIZED", "请先登录", 401);
      if (user.isDisabled) throw new ApiError("USER_DISABLED", "账号已被禁用", 403);

      if (!(env.adminBypassDailyQuota && user.role === UserRole.ADMIN)) {
        const usedToday = await tx.imageJob.count({
          where: {
            userId: user.id,
            quotaDate: currentQuotaDate,
            quotaCharged: true,
            quotaRefundedAt: null
          }
        });
        if (usedToday >= user.dailyQuota) {
          throw new ApiError("DAILY_QUOTA_EXCEEDED", "今日生成额度已用完", 429);
        }
      }

      if (user.role !== UserRole.ADMIN) {
        const activeJobs = await tx.imageJob.count({
          where: {
            userId: user.id,
            status: { in: [JobStatus.PENDING_ENQUEUE, JobStatus.QUEUED, JobStatus.RUNNING] }
          }
        });
        if (activeJobs >= env.maxUserActiveJobs) {
          throw new ApiError("USER_ACTIVE_JOB_LIMIT", "你已有任务正在排队或生成中", 429);
        }
      }

      const queuedJobs = await tx.imageJob.count({
        where: {
          status: { in: [JobStatus.PENDING_ENQUEUE, JobStatus.QUEUED] }
        }
      });
      if (queuedJobs >= env.maxQueueLength) {
        throw new ApiError("QUEUE_FULL", "当前排队人数较多，请稍后再试", 429);
      }

      const created = await tx.imageJob.create({
        data: {
          id: jobId,
          userId: user.id,
          model: env.imageModel,
          mode: storedInputImages.length ? "EDIT" : "GENERATE",
          prompt: input.prompt,
          size: input.size,
          quality: input.quality,
          outputFormat: env.defaultImageFormat,
          inputImages: storedInputImages.length ? storedInputImages : undefined,
          status: JobStatus.PENDING_ENQUEUE,
          quotaDate: currentQuotaDate,
          requestIpHash: ipHash,
          userAgent
        }
      });

      await tx.queueOutbox.create({ data: { imageJobId: created.id } });
      await tx.usageLog.create({
        data: { userId: user.id, imageJobId: created.id, action: "CREATE_JOB", status: "OK" }
      });

      return created;
    });
  } catch (error) {
    await deleteInputImages(storedInputImages);
    throw error;
  }

  try {
    await enqueuePendingJob(imageJob.id);
  } catch (error) {
    console.warn("Image job created but enqueue failed; outbox will retry.", error);
  }

  return prisma.imageJob.findUniqueOrThrow({ where: { id: imageJob.id } });
}

export async function getAuthorizedJob(id: string, user: { id: string; role: UserRole }) {
  const job = await prisma.imageJob.findUnique({ where: { id } });
  if (!job) throw new ApiError("JOB_NOT_FOUND", "任务不存在", 404);
  if (user.role !== UserRole.ADMIN && job.userId !== user.id) {
    throw new ApiError("JOB_NOT_FOUND", "任务不存在", 404);
  }
  return job;
}

export async function remainingQuota(user: { id: string; role: UserRole; dailyQuota: number }) {
  if (env.adminBypassDailyQuota && user.role === UserRole.ADMIN) {
    return 9999;
  }
  const used = await prisma.imageJob.count({
    where: {
      userId: user.id,
      quotaDate: quotaDate(),
      quotaCharged: true,
      quotaRefundedAt: null
    }
  });
  return Math.max(0, user.dailyQuota - used);
}

export function publicJob(job: {
  id: string;
  prompt: string;
  model: string;
  mode: string;
  inputImages: unknown;
  status: JobStatus;
  size: string;
  quality: string;
  attempts: number;
  createdAt: Date;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultDeletedAt: Date | null;
}) {
  const urls = imageUrls(job);
  const durations = jobDurations(job);
  return {
    id: job.id,
    prompt: job.prompt,
    model: job.model,
    mode: job.mode,
    inputImageCount: parseStoredInputImages(job.inputImages).length,
    status: job.status,
    statusLabel: statusLabel(job.status),
    size: job.size,
    quality: job.quality,
    attempts: job.attempts,
    createdAt: job.createdAt,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    ...durations,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    displayError: friendlyErrorMessage(job.errorCode, job.errorMessage),
    imageUrl: urls.imageUrl,
    downloadUrl: urls.downloadUrl
  };
}
