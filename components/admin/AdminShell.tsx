"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Image, KeyRound, Menu, ShieldCheck, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, type MeResponse } from "@/components/api";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

type AdminShellProps = {
  initialUser: NonNullable<MeResponse["user"]>;
  children: React.ReactNode;
};

const navItems = [
  { href: "/admin", label: "用户总览", icon: UsersRound },
  { href: "/admin/images", label: "用户图片", icon: Image },
  { href: "/admin/invites", label: "邀请码", icon: KeyRound },
  { href: "/admin/jobs", label: "任务运维", icon: Activity }
];

function adminTitle(pathname: string) {
  if (pathname.startsWith("/admin/images")) return "用户图片";
  if (pathname.startsWith("/admin/invites")) return "邀请码管理";
  if (pathname.startsWith("/admin/jobs")) return "任务运维";
  return "用户总览";
}

export function AdminShell({ initialUser, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <aside className="admin-sidebar card">
      <div className="admin-sidebar-brand">
        <Link href="/admin" className="brand">Image Lab Ops</Link>
        <Button className="mobile-only" type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="关闭导航">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="admin-sidebar-kicker">
        <ShieldCheck className="h-4 w-4" />
        <span>运维控制台</span>
      </div>

      <nav className="admin-sidebar-nav" aria-label="运维控制台导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              className={active ? "admin-sidebar-link active" : "admin-sidebar-link"}
              href={item.href}
              key={item.href}
              onClick={() => setSidebarOpen(false)}
              onMouseEnter={() => router.prefetch(item.href)}
              onFocus={() => router.prefetch(item.href)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-foot">
        <p className="muted">用户、图片、邀请码和任务队列集中在这里处理。</p>
        <Link className="admin-workspace-link" href="/generate">
          <Sparkles className="h-4 w-4" />
          图像生成工作台
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="admin-shell">
      <div className={sidebarOpen ? "admin-sidebar-layer open" : "admin-sidebar-layer"} onClick={() => setSidebarOpen(false)} />
      <div className={sidebarOpen ? "admin-sidebar-wrap open" : "admin-sidebar-wrap"}>{sidebar}</div>

      <main className="admin-main">
        <header className="admin-topbar card">
          <div className="admin-topbar-left">
            <Button className="mobile-only" type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="打开导航">
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="muted">Operations</p>
              <strong>{adminTitle(pathname)}</strong>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <Link className="button secondary" href="/generate">
              <Sparkles className="h-4 w-4" />
              工作台
            </Link>
            <ThemeToggle />
            <details className="user-menu">
              <summary>
                <UserRound className="h-4 w-4" />
                <span>{initialUser.email}</span>
              </summary>
              <div className="user-menu-panel card">
                <p className="muted">{initialUser.role}</p>
                <button type="button" onClick={logout}>退出登录</button>
              </div>
            </details>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </main>
    </div>
  );
}
