import { JobStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { ApiError, jsonError } from "@/lib/http";
import { getAuthorizedJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { readImageFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: any) {
  try {
    const user = await requireUser();
    const job = await getAuthorizedJob(context.params.id, user);
    if (job.status !== JobStatus.COMPLETED || !job.resultPath) {
      throw new ApiError("IMAGE_NOT_READY", "图片尚未生成完成", 409);
    }
    if (job.resultDeletedAt) throw new ApiError("IMAGE_EXPIRED", "图片已过期", 404);
    const buffer = await readImageFile(job.resultPath);
    await prisma.usageLog.create({
      data: { userId: user.id, imageJobId: job.id, action: "DOWNLOAD", status: "OK" }
    });
    return new Response(buffer, {
      headers: {
        "Content-Type": job.resultMime ?? "image/png",
        "Content-Disposition": `attachment; filename="${job.id}.png"`,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
