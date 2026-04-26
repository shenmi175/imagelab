import { headers } from "next/headers";
import { UserRole, type User } from "@prisma/client";
import { auth } from "@/lib/better-auth";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";

export type AppUser = Pick<User, "id" | "email" | "role" | "dailyQuota" | "isDisabled">;

export async function currentUser() {
  const headerBag = await headers();
  const session = await auth.api.getSession({ headers: new Headers(headerBag) });
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      dailyQuota: true,
      isDisabled: true
    }
  });
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

export function publicUser(user: { id: string; email: string; role: UserRole; dailyQuota: number }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    dailyQuota: user.dailyQuota
  };
}
