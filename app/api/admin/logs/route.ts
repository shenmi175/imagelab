import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim();
    const action = url.searchParams.get("action")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const userId = url.searchParams.get("userId")?.trim();
    const imageJobId = url.searchParams.get("imageJobId")?.trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 200);

    const items = await prisma.usageLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(imageJobId ? { imageJobId } : {}),
        ...(q
          ? {
              OR: [
                { action: { contains: q, mode: "insensitive" as const } },
                { status: { contains: q, mode: "insensitive" as const } },
                { detail: { contains: q, mode: "insensitive" as const } },
                { user: { email: { contains: q, mode: "insensitive" as const } } },
                { imageJobId: { contains: q, mode: "insensitive" as const } }
              ]
            }
          : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { email: true } },
        imageJob: { select: { id: true, prompt: true, status: true, errorCode: true } }
      }
    });

    return jsonOk({ items });
  } catch (error) {
    return jsonError(error);
  }
}
