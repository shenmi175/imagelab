import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell public-shell">
      <header className="public-nav">
        <Link href="/login" className="brand">
          Image Lab
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
