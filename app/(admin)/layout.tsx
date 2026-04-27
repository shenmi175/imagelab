import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { publicUser, requireAdmin } from "@/lib/auth";
import { ApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await requireAdmin();
    return <AdminShell initialUser={publicUser(user)}>{children}</AdminShell>;
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
      redirect("/login");
    }

    return (
      <main className="admin-auth-required card">
        <p className="muted">Operations console</p>
        <h1>需要管理员权限</h1>
        <p className="muted">当前账号不能访问运维控制台。</p>
        <Link className="button secondary" href="/generate">返回图像工作台</Link>
      </main>
    );
  }
}
