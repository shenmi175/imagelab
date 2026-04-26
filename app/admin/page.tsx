"use client";

import { useEffect, useState } from "react";
import { apiFetch, PublicJob } from "@/components/api";

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
  errorCode?: string | null;
  upstreamStatus?: number | null;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [queueBoardUrl, setQueueBoardUrl] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [usersData, jobsData, codesData, statsData, configData] = await Promise.all([
        apiFetch<{ items: UserRow[] }>("/api/admin/users"),
        apiFetch<{ items: AdminJob[] }>("/api/admin/image-jobs"),
        apiFetch<{ items: InviteCode[] }>("/api/admin/invite-codes"),
        apiFetch<Record<string, number>>("/api/admin/stats"),
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
  }, []);

  return (
    <main className="grid" style={{ paddingBottom: "4rem" }}>
      <section className="card" style={{ padding: "2rem" }}>
        <p className="muted">Admin</p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "4rem", lineHeight: 1 }}>管理后台</h1>
        {queueBoardUrl ? (
          <p>
            <a className="button secondary" href={queueBoardUrl} target="_blank" rel="noreferrer">
              打开队列看板
            </a>
          </p>
        ) : null}
        {error ? <p style={{ color: "#9b2c1f" }}>{error}</p> : null}
        <div className="grid three">
          {Object.entries(stats).map(([key, value]) => (
            <div className="card" style={{ padding: "1rem" }} key={key}>
              <p className="muted">{key}</p>
              <strong style={{ fontSize: "2rem" }}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem" }}>用户</h2>
        {users.map((user) => (
          <div className="list-row" key={user.id}>
            <div>
              <strong>{user.email}</strong>
              <p className="muted">{user.role} / quota {user.dailyQuota} / jobs {user._count.imageJobs}</p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="button secondary" onClick={() => updateUser(user, { dailyQuota: user.dailyQuota + 1 })}>额度 +1</button>
              <button className="button secondary" onClick={() => updateUser(user, { dailyQuota: Math.max(0, user.dailyQuota - 1) })}>额度 -1</button>
              <button className={user.isDisabled ? "button secondary" : "button danger"} onClick={() => updateUser(user, { isDisabled: !user.isDisabled })}>
                {user.isDisabled ? "启用" : "禁用"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem" }}>邀请码</h2>
          <button className="button" onClick={createInvite}>生成邀请码</button>
        </div>
        {codes.map((code) => (
          <div className="list-row" key={code.id}>
            <div>
              <strong>{code.code}</strong>
              <p className="muted">{code.usedAt ? `已使用 by ${code.usedById}` : "未使用"}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ padding: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem" }}>任务</h2>
        {jobs.map((job) => (
          <div className="list-row" key={job.id}>
            <div>
              <span className="status">{job.status}</span>
              <p>{job.prompt.slice(0, 180)}</p>
              <p className="muted">{job.userEmail} / {job.errorCode ?? "no error"} / upstream {job.upstreamStatus ?? "-"}</p>
            </div>
            <button className="button danger" onClick={() => deleteJob(job.id)}>删除</button>
          </div>
        ))}
      </section>
    </main>
  );
}
