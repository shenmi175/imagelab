import Link from "next/link";
import AdminClient from "./AdminClient";
import { requireAdmin } from "@/lib/auth";
import { ApiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch (error) {
    return (
      <main className="card auth-required">
        <p className="muted">Admin only</p>
        <h1>需要管理员权限</h1>
        <p className="muted">当前账号不是管理员，不能查看后台控制台。</p>
        <Link className="button secondary" href="/generate">返回工作台</Link>
      </main>
    );
  }

  return <AdminClient />;
}
