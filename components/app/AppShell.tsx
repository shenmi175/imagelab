"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Image, LayoutDashboard, Menu, Shield, Sparkles, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type MeResponse } from "@/components/api";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
};

const publicRoutes = new Set(["/", "/login", "/register"]);

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
    retry: false
  });
  const user = meQuery.data?.user ?? null;
  const remainingQuota = meQuery.data?.remainingQuota;
  const isPublic = publicRoutes.has(pathname);

  if (isPublic || !user) {
    return (
      <div className="shell public-shell">
        <header className="public-nav">
          <Link href={user ? "/generate" : "/login"} className="brand">
            Image Lab
          </Link>
          <div className="nav-actions">
            <ThemeToggle />
            {user ? (
              <Link className="button secondary" href="/generate">进入工作台</Link>
            ) : (
              <>
                <Link className="nav-link" href="/login">登录</Link>
                <Link className="button secondary" href="/register">注册</Link>
              </>
            )}
          </div>
        </header>
        {children}
      </div>
    );
  }

  const navItems = [
    { href: "/generate", label: "生成", icon: Sparkles },
    { href: "/gallery", label: "图库", icon: Image },
    { href: "/jobs", label: "任务", icon: LayoutDashboard },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "管理", icon: Shield }] : [])
  ];

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const sidebar = (
    <aside className="app-sidebar card">
      <div className="sidebar-brand">
        <Link href="/generate" className="brand">Image Lab</Link>
        <Button className="mobile-only" type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="关闭导航">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="sidebar-nav" aria-label="工作台导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link className={active ? "sidebar-link active" : "sidebar-link"} href={item.href} key={item.href} onClick={() => setSidebarOpen(false)}>
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <p className="muted">体验站额度由管理员控制。图片仅通过鉴权接口访问。</p>
      </div>
    </aside>
  );

  return (
    <div className="app-shell">
      <div className={sidebarOpen ? "sidebar-layer open" : "sidebar-layer"} onClick={() => setSidebarOpen(false)} />
      <div className={sidebarOpen ? "sidebar-wrap open" : "sidebar-wrap"}>{sidebar}</div>

      <main className="app-main">
        <header className="topbar card">
          <div className="topbar-left">
            <Button className="mobile-only" type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="打开导航">
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="muted">Workspace</p>
              <strong>{pathname.startsWith("/admin") ? "管理后台" : "图像生成工作台"}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <div className="quota-pill">
              <span>今日额度</span>
              <strong>{remainingQuota ?? "-"}</strong>
            </div>
            <ThemeToggle />
            <details className="user-menu">
              <summary>
                <UserRound className="h-4 w-4" />
                <span>{user.email}</span>
              </summary>
              <div className="user-menu-panel card">
                <p className="muted">{user.role}</p>
                <button type="button" onClick={logout}>退出登录</button>
              </div>
            </details>
          </div>
        </header>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
