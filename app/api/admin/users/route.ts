import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const users = await prisma.user.findMany({
      where: q ? { email: { contains: q, mode: "insensitive" } } : undefined,
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
