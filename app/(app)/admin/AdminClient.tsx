"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { apiFetch } from "@/components/api";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatDuration } from "@/lib/duration";
import type { AdminStats, UserRow } from "@/components/admin/AdminTypes";

export default function AdminClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [queueBoardUrl, setQueueBoardUrl] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const userSuffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const [usersData, statsData, configData] = await Promise.all([
        apiFetch<{ items: UserRow[] }>(`/api/admin/users${userSuffix}`),
        apiFetch<AdminStats>("/api/admin/stats"),
        apiFetch<{ queueBoardUrl: string }>("/api/admin/config")
      ]);
      setUsers(usersData.items);
      setStats(statsData);
      setQueueBoardUrl(configData.queueBoardUrl);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function updateUser(user: UserRow, patch: Partial<UserRow>) {
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    await load();
  }

  useEffect(() => {
    void load();
  }, [search]);

  const statCards = stats
    ? [
        ["用户数", stats.users],
        ["今日任务", stats.todayJobs],
        ["今日完成", stats.completedToday],
        ["今日失败", stats.failedToday],
        ["排队中", stats.queuedJobs],
        ["生成中", stats.runningJobs],
        ["活跃 Worker", stats.activeWorkers],
        ["平均生成", formatDuration(stats.averageGenerationDurationMs)],
        ["平均排队", formatDuration(stats.averageQueueDurationMs)]
      ]
    : [];

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <p className="muted">Admin console</p>
          <h1>后台控制台</h1>
          <p className="muted">后台已按用户、用户图片、邀请码、任务管理分区。</p>
        </div>
        {queueBoardUrl ? (
          <a className="button secondary" href={queueBoardUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            队列看板
          </a>
        ) : null}
      </section>

      <AdminTabs />

      {error ? <p className="error-text">{error}</p> : null}

      <section className="stats-grid">
        {statCards.map(([label, value]) => (
          <div className="metric-card card" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <p className="muted">Users</p>
            <h2>用户管理</h2>
          </div>
          <div className="search-box">
            <Search className="h-4 w-4" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索用户邮箱" />
          </div>
        </div>
        <div className="table-list">
          {users.map((user) => (
            <div className="table-row" key={user.id}>
              <div>
                <strong>{user.email}</strong>
                <p className="muted">{user.role} / quota {user.dailyQuota} / jobs {user._count.imageJobs} / {formatDateTime(user.createdAt)}</p>
              </div>
              <div className="action-row">
                <Button variant="secondary" onClick={() => updateUser(user, { dailyQuota: user.dailyQuota + 1 })}>额度 +1</Button>
                <Button variant="secondary" onClick={() => updateUser(user, { dailyQuota: Math.max(0, user.dailyQuota - 1) })}>额度 -1</Button>
                <Button variant={user.isDisabled ? "outline" : "destructive"} onClick={() => updateUser(user, { isDisabled: !user.isDisabled })}>
                  {user.isDisabled ? "启用" : "禁用"}
                </Button>
                <Link className="button secondary" href={`/admin/images?userId=${encodeURIComponent(user.id)}&email=${encodeURIComponent(user.email)}`}>
                  查看图片
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
