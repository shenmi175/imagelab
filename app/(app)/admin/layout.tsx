import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    return (
      <main className="card auth-required">
        <p className="muted">Admin only</p>
        <h1>需要管理员权限</h1>
        <p className="muted">当前账号不是管理员，不能查看后台控制台。</p>
        <Link className="button secondary" href="/generate">返回工作台</Link>
      </main>
    );
  }

  return children;
}
