import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT Image Experience",
  description: "Private queue-based GPT image generation site"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="shell">
            <header className="nav">
              <Link href="/dashboard" className="brand">
                Image Lab
              </Link>
              <div className="nav-actions">
                <nav className="nav-links" aria-label="主导航">
                  <Link className="nav-link" href="/generate">生成</Link>
                  <Link className="nav-link" href="/dashboard">任务</Link>
                  <Link className="nav-link" href="/admin">管理</Link>
                </nav>
                <ThemeToggle />
              </div>
            </header>
            {children}
          </div>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
