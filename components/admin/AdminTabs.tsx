"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "用户" },
  { href: "/admin/images", label: "用户图片" },
  { href: "/admin/invites", label: "邀请码" },
  { href: "/admin/jobs", label: "任务管理" }
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="admin-tabs card" aria-label="后台管理导航">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link className={active ? "admin-tab active" : "admin-tab"} href={tab.href} key={tab.href}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
