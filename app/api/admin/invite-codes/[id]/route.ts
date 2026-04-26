import { requireAdmin } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { assertSameOrigin, jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: any) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    await requireAdmin();
    const id = Number(context.params.id);
    await prisma.inviteCode.deleteMany({ where: { id, usedAt: null } });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
