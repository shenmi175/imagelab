import { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { assertSameOrigin, jsonError, jsonOk, requestIpHash } from "@/lib/http";
import { createImageJob, publicJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { validatePrompt, validateQuality, validateSize } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const ipHash = await requestIpHash();
    await rateLimit(`poll:${user.id}:${ipHash}`, env.pollUserMinuteLimit, 60);

    const items = await prisma.imageJob.findMany({
      where: user.role === UserRole.ADMIN ? {} : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return jsonOk({ items: items.map(publicJob) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const user = await requireUser();
    const ipHash = await requestIpHash();
    await rateLimit(`create-job:${user.id}:${ipHash}`, env.createJobUserMinuteLimit, 60);

    const body = await request.json();
    const prompt = validatePrompt(body.prompt);
    const size = validateSize(body.size);
    const quality = validateQuality(body.quality);

    const job = await createImageJob({ user, prompt, size, quality });
    return jsonOk({ ...publicJob(job), message: "任务已创建" }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
