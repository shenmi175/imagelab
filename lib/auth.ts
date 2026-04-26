import { cookies } from "next/headers";
import argon2 from "argon2";
import { UserRole } from "@prisma/client";
import { env } from "@/lib/env";
import { hmac, randomToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { addDays } from "@/lib/time";
import { ApiError } from "@/lib/http";

export async function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}

export async function createSession(userId: number) {
  const token = randomToken(32);
  const tokenHash = hmac(token);
  const expiresAt = addDays(new Date(), env.sessionTtlDays);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(env.sessionCookieName, token, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hmac(token) } });
  }
  cookieStore.delete(env.sessionCookieName);
}

export async function currentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.sessionCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hmac(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new ApiError("UNAUTHORIZED", "请先登录", 401);
  if (user.isDisabled) throw new ApiError("USER_DISABLED", "账号已被禁用", 403);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) throw new ApiError("FORBIDDEN", "需要管理员权限", 403);
  return user;
}

export function publicUser(user: { id: number; email: string; role: UserRole; dailyQuota: number }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    dailyQuota: user.dailyQuota
  };
}
