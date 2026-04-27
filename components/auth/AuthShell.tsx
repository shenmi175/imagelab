"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AuthOceanVisual } from "@/components/auth/AuthOceanVisual";

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isRegister = pathname === "/register";

  useEffect(() => {
    router.prefetch("/login");
    router.prefetch("/register");
  }, [router]);

  return (
    <div className="shell public-shell">
      <header className="public-nav">
        <Link href="/login" className="brand">
          image.perceptleap.com
        </Link>
        <div className="nav-actions">
          <ThemeToggle />
          <Link className={isRegister ? "auth-nav-button" : "auth-nav-button active"} href="/login" prefetch>
            登录
          </Link>
          <Link className={isRegister ? "auth-nav-button active" : "auth-nav-button"} href="/register" prefetch>
            注册
          </Link>
        </div>
      </header>

      <main className="auth-experience">
        <AuthOceanVisual
          eyebrow="内测体验"
          title={
            <>
              图像创作
            </>
          }
        />
        {children}
      </main>
    </div>
  );
}
