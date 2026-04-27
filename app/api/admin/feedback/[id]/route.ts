import { FeedbackStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { ApiError, assertSameOrigin, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const statuses = new Set(Object.values(FeedbackStatus));

export async function PATCH(request: Request, context: any) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    const data: {
      status?: FeedbackStatus;
      adminNote?: string | null;
      resolvedAt?: Date | null;
    } = {};

    if (typeof body.status === "string") {
      if (!statuses.has(body.status as FeedbackStatus)) {
        throw new ApiError("INVALID_INPUT", "反馈状态不支持");
      }
      data.status = body.status as FeedbackStatus;
      data.resolvedAt = body.status === FeedbackStatus.RESOLVED || body.status === FeedbackStatus.IGNORED ? new Date() : null;
    }

    if (typeof body.adminNote === "string") {
      data.adminNote = body.adminNote.trim().slice(0, 3000) || null;
    }

    const feedback = await prisma.feedback
      .update({
        where: { id },
        data,
        include: {
          user: { select: { email: true } },
          imageJob: {
            select: {
              id: true,
              prompt: true,
              status: true,
              errorCode: true,
              upstreamStatus: true,
              upstreamRequestId: true
            }
          }
        }
      })
      .catch(() => null);

    if (!feedback) throw new ApiError("FEEDBACK_NOT_FOUND", "反馈不存在", 404);

    await prisma.usageLog.create({
      data: {
        userId: admin.id,
        imageJobId: feedback.imageJobId,
        action: "ADMIN_UPDATE_FEEDBACK",
        status: "OK",
        detail: JSON.stringify({ feedbackId: id, data })
      }
    });

    return jsonOk({ feedback });
  } catch (error) {
    return jsonError(error);
  }
}
