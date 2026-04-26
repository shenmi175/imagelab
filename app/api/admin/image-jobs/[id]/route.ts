import { requireAdmin } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { assertSameOrigin, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteImageFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: any) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const job = await prisma.imageJob.findUnique({ where: { id } });
    if (!job) return jsonOk({ ok: true });

    await deleteImageFile(job.resultPath);
    await prisma.imageJob.delete({ where: { id } });
    await prisma.usageLog.create({
      data: {
        userId: admin.id,
        action: "ADMIN_DELETE_JOB",
        status: "OK",
        detail: JSON.stringify({ imageJobId: id })
      }
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
