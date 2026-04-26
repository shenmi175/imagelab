import { JobStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { quotaDate } from "@/lib/time";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const [users, todayJobs, queued, running, failed] = await Promise.all([
      prisma.user.count(),
      prisma.imageJob.count({ where: { quotaDate: quotaDate() } }),
      prisma.imageJob.count({ where: { status: { in: [JobStatus.PENDING_ENQUEUE, JobStatus.QUEUED] } } }),
      prisma.imageJob.count({ where: { status: JobStatus.RUNNING } }),
      prisma.imageJob.count({ where: { status: JobStatus.FAILED } })
    ]);
    return jsonOk({ users, todayJobs, queued, running, failed });
  } catch (error) {
    return jsonError(error);
  }
}
