import { JobStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { ApiError, jsonError } from "@/lib/http";
import { getAuthorizedJob } from "@/lib/jobs";
import { readImageFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: any) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const job = await getAuthorizedJob(id, user);
    if (job.status !== JobStatus.COMPLETED || !job.resultPath) {
      throw new ApiError("IMAGE_NOT_READY", "图片尚未生成完成", 409);
    }
    if (job.resultDeletedAt) throw new ApiError("IMAGE_EXPIRED", "图片已过期", 404);

    const filePath = job.thumbnailPath ?? job.resultPath;
    const buffer = await readImageFile(filePath);

    return new Response(buffer, {
      headers: {
        "Content-Type": job.thumbnailMime ?? job.resultMime ?? "image/png",
        "Content-Disposition": `inline; filename="${job.id}-thumb.png"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
