import { requireUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { env } from "@/lib/env";
import { ApiError, assertSameOrigin, jsonError, jsonOk, requestIpHash, requestUserAgent } from "@/lib/http";
import { getAuthorizedJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const feedbackTypes = new Set(["GENERAL", "BUG", "GENERATION_FAILED", "BILLING", "SUGGESTION"]);

function optionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function feedbackType(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "GENERAL";
  return feedbackTypes.has(normalized) ? normalized : "GENERAL";
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const user = await requireUser();
    const ipHash = await requestIpHash();
    await rateLimit(`feedback:${user.id}:${ipHash}`, env.feedbackUserHourLimit, 3600);

    const body = await request.json();
    const message = optionalString(body.message, 2000);
    if (!message || message.length < 2) {
      throw new ApiError("INVALID_INPUT", "反馈内容不能为空");
    }

    const imageJobId = optionalString(body.imageJobId, 128);
    if (imageJobId) {
      await getAuthorizedJob(imageJobId, user);
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        imageJobId,
        type: feedbackType(body.type),
        message,
        contact: optionalString(body.contact, 500),
        pageUrl: optionalString(body.pageUrl, 1000),
        requestIpHash: ipHash,
        userAgent: await requestUserAgent()
      }
    });

    await prisma.usageLog.create({
      data: {
        userId: user.id,
        imageJobId,
        action: "SUBMIT_FEEDBACK",
        status: "OK",
        detail: JSON.stringify({ feedbackId: feedback.id, type: feedback.type })
      }
    });

    return jsonOk({ feedback, message: "反馈已提交" }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
