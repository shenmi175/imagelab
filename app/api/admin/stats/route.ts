import { FeedbackStatus, JobStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { jobDurations } from "@/lib/duration";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import { quotaDate } from "@/lib/time";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const today = quotaDate();
    const [
      users,
      totalJobs,
      completedJobs,
      failedJobs,
      todayJobs,
      completedToday,
      failedToday,
      queuedJobs,
      runningJobs,
      openFeedback,
      reviewingFeedback,
      recentCompleted,
      workerKeys
    ] = await Promise.all([
      prisma.user.count(),
      prisma.imageJob.count(),
      prisma.imageJob.count({ where: { status: JobStatus.COMPLETED } }),
      prisma.imageJob.count({ where: { status: JobStatus.FAILED } }),
      prisma.imageJob.count({ where: { quotaDate: today } }),
      prisma.imageJob.count({ where: { quotaDate: today, status: JobStatus.COMPLETED } }),
      prisma.imageJob.count({ where: { quotaDate: today, status: JobStatus.FAILED } }),
      prisma.imageJob.count({ where: { status: { in: [JobStatus.PENDING_ENQUEUE, JobStatus.QUEUED] } } }),
      prisma.imageJob.count({ where: { status: JobStatus.RUNNING } }),
      prisma.feedback.count({ where: { status: FeedbackStatus.OPEN } }),
      prisma.feedback.count({ where: { status: FeedbackStatus.REVIEWING } }),
      prisma.imageJob.findMany({
        where: { status: JobStatus.COMPLETED, startedAt: { not: null }, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 200,
        select: { createdAt: true, startedAt: true, completedAt: true }
      }),
      getRedis().keys("image-site:worker:*:heartbeat").catch(() => [])
    ]);

    const generationDurations = recentCompleted
      .map((job) => jobDurations(job).generationDurationMs)
      .filter((value): value is number => typeof value === "number");
    const queueDurations = recentCompleted
      .map((job) => jobDurations(job).queueDurationMs)
      .filter((value): value is number => typeof value === "number");
    const average = (values: number[]) =>
      values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

    return jsonOk({
      users,
      totalJobs,
      completedJobs,
      failedJobs,
      todayJobs,
      completedToday,
      failedToday,
      queuedJobs,
      runningJobs,
      openFeedback,
      reviewingFeedback,
      activeWorkers: workerKeys.length,
      averageGenerationDurationMs: average(generationDurations),
      averageQueueDurationMs: average(queueDurations)
    });
  } catch (error) {
    return jsonError(error);
  }
}
