import { prisma } from "@/lib/prisma";
import { assertSameOrigin, jsonError, jsonOk, requestIpHash } from "@/lib/http";
import { createSession, publicUser, verifyPassword } from "@/lib/auth";
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
    const email = normalizeEmail(body.email);
    const password = validatePassword(body.password);

    await rateLimit(`login:ip:${ipHash}`, env.loginIpMinuteLimit, 60);
    await rateLimit(`login:email:${email}`, env.loginEmailHourLimit, 3600);
    await verifyTurnstile(body.turnstileToken);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      if (user) {
        await prisma.usageLog.create({ data: { userId: user.id, action: "LOGIN", status: "FAILED" } });
      }
      return Response.json({ error: "INVALID_INPUT", message: "邮箱或密码错误" }, { status: 400 });
    }

    if (user.isDisabled) {
      return Response.json({ error: "USER_DISABLED", message: "账号已被禁用" }, { status: 403 });
    }

    await createSession(user.id);
    await prisma.usageLog.create({ data: { userId: user.id, action: "LOGIN", status: "OK" } });
    return jsonOk({ ok: true, user: publicUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
