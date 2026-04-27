import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { currentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user) redirect(user.role === UserRole.ADMIN ? "/admin" : "/generate");

  return (
    <div className="shell public-shell">
      <header className="public-nav">
        <Link href="/login" className="brand">
          图像实验室
        </Link>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className="nav-link" href="/login">登录</Link>
          <Link className="button secondary" href="/register">注册</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
