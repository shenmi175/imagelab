import { requireAdmin } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { assertSameOrigin, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: any) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const admin = await requireAdmin();
    const id = String(context.params.id);
    const body = await request.json();

    const data: { dailyQuota?: number; isDisabled?: boolean } = {};
    if (typeof body.dailyQuota === "number" && Number.isInteger(body.dailyQuota) && body.dailyQuota >= 0) {
      data.dailyQuota = body.dailyQuota;
    }
    if (typeof body.isDisabled === "boolean") {
      data.isDisabled = body.isDisabled;
    }

    const user = await prisma.user.update({ where: { id }, data });
    await prisma.usageLog.create({
      data: {
        userId: admin.id,
        action: "ADMIN_UPDATE_USER",
        status: "OK",
        detail: JSON.stringify({ targetUserId: id, data })
      }
    });
    return jsonOk({ user });
  } catch (error) {
    return jsonError(error);
  }
}
