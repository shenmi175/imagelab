"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { apiFetch } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatDuration } from "@/lib/duration";
import type { AdminStats, UserRow } from "@/components/admin/AdminTypes";

function roleLabel(role: string) {
  return role === "ADMIN" ? "管理员" : "用户";
}

export default function AdminClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [queueBoardUrl, setQueueBoardUrl] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [quotaDrafts, setQuotaDrafts] = useState<Record<string, string>>({});

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

  function quotaDraft(user: UserRow) {
    return quotaDrafts[user.id] ?? String(user.dailyQuota);
  }

  function setQuotaDraft(user: UserRow, value: string) {
    setQuotaDrafts((current) => ({ ...current, [user.id]: value }));
  }

  async function saveQuota(user: UserRow) {
    const value = Number(quotaDraft(user));
    if (!Number.isInteger(value) || value < 0) {
      setError("额度必须是大于等于 0 的整数");
      return;
    }
    await updateUser(user, { dailyQuota: value });
    setQuotaDrafts((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });
  }

  useEffect(() => {
    void load();
  }, [search]);

  const statCards = stats
    ? [
        ["用户总数", stats.users],
        ["已生成图片", stats.completedJobs],
        ["失败任务", stats.failedJobs],
        ["总任务", stats.totalJobs],
        ["今日任务", stats.todayJobs],
        ["今日完成", stats.completedToday],
        ["今日失败", stats.failedToday],
        ["待处理反馈", stats.openFeedback],
        ["处理中反馈", stats.reviewingFeedback]
      ]
    : [];
  const successRate = stats && stats.completedJobs + stats.failedJobs > 0
    ? Math.round((stats.completedJobs / (stats.completedJobs + stats.failedJobs)) * 100)
    : 0;
  const statusRows = stats
    ? [
        { label: "已完成", value: stats.completedJobs, tone: "success" },
        { label: "失败", value: stats.failedJobs, tone: "danger" },
        { label: "排队中", value: stats.queuedJobs, tone: "warning" },
        { label: "生成中", value: stats.runningJobs, tone: "info" }
      ]
    : [];
  const maxStatusValue = Math.max(1, ...statusRows.map((row) => row.value));

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <h1>后台控制台</h1>
          <p className="muted">集中查看平台运行状态，管理用户额度和账号状态。</p>
        </div>
        {queueBoardUrl ? (
          <a className="button secondary" href={queueBoardUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            队列看板
          </a>
        ) : null}
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="stats-grid">
        {statCards.map(([label, value]) => (
          <div className="metric-card card" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      {stats ? (
        <section className="ops-monitor-grid">
          <div className="ops-monitor-card card">
            <div className="section-heading compact">
              <div>
                <h2>任务状态</h2>
              </div>
              <strong>{successRate}%</strong>
            </div>
            <p className="muted">成功率按已完成和失败任务计算。</p>
            <div className="ops-bars">
              {statusRows.map((row) => (
                <div className="ops-bar-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="ops-bar">
                    <i className={`ops-bar-fill ${row.tone}`} style={{ width: `${Math.max(4, (row.value / maxStatusValue) * 100)}%` }} />
                  </div>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-monitor-card card">
            <div>
              <h2>今日概览</h2>
            </div>
            <div className="ops-split-metrics">
              <div>
                <span className="muted">任务</span>
                <strong>{stats.todayJobs}</strong>
              </div>
              <div>
                <span className="muted">完成</span>
                <strong>{stats.completedToday}</strong>
              </div>
              <div>
                <span className="muted">失败</span>
                <strong>{stats.failedToday}</strong>
              </div>
            </div>
          </div>

          <div className="ops-monitor-card card">
            <div>
              <h2>运行状态</h2>
            </div>
            <div className="ops-split-metrics">
              <div>
                <span className="muted">工作进程</span>
                <strong>{stats.activeWorkers}</strong>
              </div>
              <div>
                <span className="muted">平均生成</span>
                <strong>{formatDuration(stats.averageGenerationDurationMs)}</strong>
              </div>
              <div>
                <span className="muted">平均排队</span>
                <strong>{formatDuration(stats.averageQueueDurationMs)}</strong>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card panel-section">
        <div className="section-heading">
          <div>
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
                <p className="muted">{roleLabel(user.role)} / 额度 {user.dailyQuota} / 任务 {user._count.imageJobs} / {formatDateTime(user.createdAt)}</p>
              </div>
              <div className="action-row">
                <div className="quota-editor">
                  <Input
                    className="quota-input"
                    type="number"
                    min="0"
                    step="1"
                    value={quotaDraft(user)}
                    onChange={(event) => setQuotaDraft(user, event.target.value)}
                    aria-label={`${user.email} 每日额度`}
                  />
                  <Button variant="secondary" onClick={() => saveQuota(user)}>保存额度</Button>
                </div>
                <Button variant="secondary" onClick={() => updateUser(user, { dailyQuota: user.dailyQuota + 1 })}>+1</Button>
                <Button variant="secondary" onClick={() => updateUser(user, { dailyQuota: Math.max(0, user.dailyQuota - 1) })}>-1</Button>
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
