"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Image, LayoutDashboard, Menu, Sparkles, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type MeResponse } from "@/components/api";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  initialUser: NonNullable<MeResponse["user"]>;
  initialRemainingQuota?: number;
  children: React.ReactNode;
};

function roleLabel(role: string) {
  return role === "ADMIN" ? "管理员" : "用户";
}

export function AppShell({ initialUser, initialRemainingQuota, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/auth/me"),
    initialData: { user: initialUser, remainingQuota: initialRemainingQuota },
    retry: false,
    staleTime: 5 * 60 * 1000
  });
  const user = meQuery.data.user ?? initialUser;
  const remainingQuota = meQuery.data?.remainingQuota;

  const navItems = [
    { href: "/generate", label: "生成", icon: Sparkles },
    { href: "/gallery", label: "图库", icon: Image },
    { href: "/jobs", label: "任务", icon: LayoutDashboard }
  ];

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  function prefetchRoute(href: string) {
    router.prefetch(href);
    if (href === "/gallery" || href === "/jobs") {
      const isGallery = href === "/gallery";
      void queryClient.prefetchInfiniteQuery({
        queryKey: ["image-jobs", isGallery ? "gallery" : "jobs", isGallery ? "COMPLETED" : ""],
        initialPageParam: null as string | null,
        queryFn: () => apiFetch<{ items: unknown[]; nextCursor?: string | null }>(isGallery ? "/api/image-jobs?status=COMPLETED&limit=24" : "/api/image-jobs?limit=24")
      });
    }
  }

  const sidebar = (
    <aside className="app-sidebar card">
      <div className="sidebar-brand">
        <Link href="/generate" className="brand">图像实验室</Link>
        <Button className="mobile-only" type="button" variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="关闭导航">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <nav className="sidebar-nav" aria-label="工作台导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              className={active ? "sidebar-link active" : "sidebar-link"}
              href={item.href}
              key={item.href}
              onClick={() => setSidebarOpen(false)}
              onMouseEnter={() => prefetchRoute(item.href)}
              onFocus={() => prefetchRoute(item.href)}
            >
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
              <strong>图像生成工作台</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <FeedbackButton compact />
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
                <p className="muted">{roleLabel(user.role)}</p>
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
