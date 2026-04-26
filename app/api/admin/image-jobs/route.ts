import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { publicJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const jobs = await prisma.imageJob.findMany({
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
        upstreamStatus: job.upstreamStatus
      }))
    });
  } catch (error) {
    return jsonError(error);
  }
}
