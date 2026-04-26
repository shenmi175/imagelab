"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Search } from "lucide-react";
import { apiFetch, PublicJob } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { formatDateTime, formatDuration } from "@/lib/duration";

type UserRow = {
  id: string;
  email: string;
  role: string;
  dailyQuota: number;
  isDisabled: boolean;
  createdAt: string;
  _count: { imageJobs: number };
};

type InviteCode = {
  id: number;
  code: string;
  usedById: string | null;
  usedAt: string | null;
  createdAt: string;
};

type AdminJob = PublicJob & {
  userEmail: string;
  userId: string;
  upstreamStatus?: number | null;
  upstreamRequestId?: string | null;
};

type AdminStats = {
  users: number;
  todayJobs: number;
  completedToday: number;
  failedToday: number;
  queuedJobs: number;
  runningJobs: number;
  activeWorkers: number;
  averageGenerationDurationMs: number;
  averageQueueDurationMs: number;
};

const statusOptions = [
  { value: "", label: "全部" },
  { value: "PENDING_ENQUEUE", label: "入队" },
  { value: "QUEUED", label: "排队" },
  { value: "RUNNING", label: "生成中" },
  { value: "COMPLETED", label: "完成" },
  { value: "FAILED", label: "失败" }
];

export default function AdminClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [queueBoardUrl, setQueueBoardUrl] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search.trim()) params.set("q", search.trim());
    return params.toString();
  }, [search, status]);

  async function load() {
    try {
      const suffix = queryString ? `?${queryString}` : "";
      const userSuffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const [usersData, jobsData, codesData, statsData, configData] = await Promise.all([
        apiFetch<{ items: UserRow[] }>(`/api/admin/users${userSuffix}`),
        apiFetch<{ items: AdminJob[] }>(`/api/admin/image-jobs${suffix}`),
        apiFetch<{ items: InviteCode[] }>("/api/admin/invite-codes"),
        apiFetch<AdminStats>("/api/admin/stats"),
        apiFetch<{ queueBoardUrl: string }>("/api/admin/config")
      ]);
      setUsers(usersData.items);
      setJobs(jobsData.items);
      setCodes(codesData.items);
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

  async function createInvite() {
    await apiFetch("/api/admin/invite-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 })
    });
    await load();
  }

  async function deleteJob(id: string) {
    if (!confirm("确定删除该任务和图片文件？")) return;
    await apiFetch(`/api/admin/image-jobs/${id}`, { method: "DELETE" });
    await load();
  }

  useEffect(() => {
    void load();
  }, [queryString]);

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
          <p className="muted">后台已和普通工作台分区；页面和接口都需要 ADMIN 角色。</p>
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

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <p className="muted">Users</p>
            <h2>用户管理</h2>
          </div>
          <div className="search-box">
            <Search className="h-4 w-4" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索邮箱 / 任务 / Job ID" />
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
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <p className="muted">Invites</p>
            <h2>邀请码</h2>
          </div>
          <Button onClick={createInvite}>生成邀请码</Button>
        </div>
        <div className="table-list">
          {codes.map((code) => (
            <div className="table-row compact" key={code.id}>
              <div>
                <strong>{code.code}</strong>
                <p className="muted">{code.usedAt ? `已使用 by ${code.usedById}` : "未使用"} / {formatDateTime(code.createdAt)}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(code.code)} aria-label="复制邀请码">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <p className="muted">Jobs</p>
            <h2>任务管理</h2>
          </div>
          <div className="filter-pills">
            {statusOptions.map((option) => (
              <button className={status === option.value ? "filter-pill active" : "filter-pill"} key={option.value} onClick={() => setStatus(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="table-list">
          {jobs.map((job) => (
            <div className="table-row" key={job.id}>
              <div>
                <JobStatusBadge job={job} />
                <p>{job.prompt.slice(0, 180)}</p>
                <p className="muted">
                  {job.userEmail} / {job.mode === "EDIT" ? `编辑 ${job.inputImageCount} 图` : "文生图"} / {job.errorCode ?? "no error"} / upstream {job.upstreamStatus ?? "-"} / 生成 {formatDuration(job.generationDurationMs)}
                </p>
                {job.upstreamRequestId ? <p className="muted">request {job.upstreamRequestId}</p> : null}
              </div>
              <div className="action-row">
                <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(job.id)} aria-label="复制 Job ID">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="destructive" onClick={() => deleteJob(job.id)}>删除</Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
