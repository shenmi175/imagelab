import { JobStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { publicJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const statuses = new Set(["PENDING_ENQUEUE", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELED", "EXPIRED"]);

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim();
    const jobs = await prisma.imageJob.findMany({
      where: {
        ...(status && statuses.has(status) ? { status: status as JobStatus } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q, mode: "insensitive" as const } },
                { prompt: { contains: q, mode: "insensitive" as const } },
                { user: { email: { contains: q, mode: "insensitive" as const } } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { email: true } } }
    });
    return jsonOk({
      items: jobs.map((job) => ({
        ...publicJob(job),
        userId: job.userId,
        userEmail: job.user.email,
        errorCode: job.errorCode,
        upstreamStatus: job.upstreamStatus,
        upstreamRequestId: job.upstreamRequestId
      }))
    });
  } catch (error) {
    return jsonError(error);
  }
}
