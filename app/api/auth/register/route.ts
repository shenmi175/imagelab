import { prisma } from "@/lib/prisma";
import { ApiError, assertSameOrigin, jsonError, jsonOk, requestIpHash } from "@/lib/http";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import { verifyCsrf } from "@/lib/csrf";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { normalizeEmail, validatePassword } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await verifyCsrf(request);
    const body = await request.json();
    const ipHash = await requestIpHash();
    await rateLimit(`register:${ipHash}`, env.registerIpHourLimit, 3600);
    await verifyTurnstile(body.turnstileToken);

    const email = normalizeEmail(body.email);
    const password = validatePassword(body.password);
    const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
    if (!inviteCode) throw new ApiError("INVALID_INPUT", "邀请码不能为空", 400);

    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({ where: { code: inviteCode } });
      if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt <= new Date())) {
        throw new ApiError("INVALID_INPUT", "邀请码无效或已使用", 400);
      }

      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          dailyQuota: env.defaultDailyQuota
        }
      });

      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedById: created.id, usedAt: new Date() }
      });

      await tx.usageLog.create({
        data: { userId: created.id, action: "REGISTER", status: "OK" }
      });

      return created;
    });

    await createSession(user.id);
    return jsonOk({ ok: true, user: publicUser(user) }, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return Response.json({ error: "INVALID_INPUT", message: "邮箱已被注册" }, { status: 400 });
    }
    return jsonError(error);
  }
}
