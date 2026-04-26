import { prisma } from "@/lib/prisma";
import { ApiError, assertSameOrigin, jsonError, jsonOkWithHeaders, requestIpHash } from "@/lib/http";
import { auth } from "@/lib/better-auth";
import { publicUser } from "@/lib/auth";
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

    const invite = await prisma.inviteCode.findUnique({ where: { code: inviteCode } });
    if (!invite || invite.usedAt || (invite.expiresAt && invite.expiresAt <= new Date())) {
      throw new ApiError("INVALID_INPUT", "邀请码无效或已使用", 400);
    }

    let authResult;
    try {
      authResult = await auth.api.signUpEmail({
        body: {
          name: email,
          email,
          password,
          rememberMe: true
        },
        headers: request.headers,
        returnHeaders: true,
        returnStatus: true
      });
    } catch {
      return Response.json({ error: "INVALID_INPUT", message: "邮箱已被注册或密码不符合要求" }, { status: 400 });
    }

    const claimed = await prisma.inviteCode.updateMany({
      where: {
        id: invite.id,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      data: { usedById: authResult.response.user.id, usedAt: new Date() }
    });

    if (claimed.count !== 1) {
      await prisma.user.delete({ where: { id: authResult.response.user.id } }).catch(() => undefined);
      throw new ApiError("INVALID_INPUT", "邀请码无效或已使用", 400);
    }

    await prisma.usageLog.create({
      data: { userId: authResult.response.user.id, action: "REGISTER", status: "OK" }
    });

    const createdUser = await prisma.user.findUniqueOrThrow({ where: { id: authResult.response.user.id } });
    return jsonOkWithHeaders({ ok: true, user: publicUser(createdUser) }, authResult.headers, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return Response.json({ error: "INVALID_INPUT", message: "邮箱已被注册" }, { status: 400 });
    }
    return jsonError(error);
  }
}
