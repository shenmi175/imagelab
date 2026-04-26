import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT Image Experience",
  description: "Private queue-based GPT image generation site"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <header className="nav">
            <Link href="/dashboard" className="brand">
              Image Lab
            </Link>
            <nav style={{ display: "flex", gap: "0.7rem", alignItems: "center", flexWrap: "wrap" }}>
              <Link href="/generate">生成</Link>
              <Link href="/dashboard">任务</Link>
              <Link href="/admin">管理</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
