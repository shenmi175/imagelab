import { FeedbackStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const statuses = new Set(Object.values(FeedbackStatus));

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const q = url.searchParams.get("q")?.trim();
    const userId = url.searchParams.get("userId")?.trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 200);

    const items = await prisma.feedback.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status && statuses.has(status as FeedbackStatus) ? { status: status as FeedbackStatus } : {}),
        ...(q
          ? {
              OR: [
                { id: { contains: q, mode: "insensitive" as const } },
                { type: { contains: q, mode: "insensitive" as const } },
                { message: { contains: q, mode: "insensitive" as const } },
                { contact: { contains: q, mode: "insensitive" as const } },
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
    });

    return jsonOk({ items });
  } catch (error) {
    return jsonError(error);
  }
}
