import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        role: true,
        dailyQuota: true,
        isDisabled: true,
        createdAt: true,
        _count: { select: { imageJobs: true } }
      }
    });
    return jsonOk({ items: users });
  } catch (error) {
    return jsonError(error);
  }
}
