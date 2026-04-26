"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, PublicJob } from "@/components/api";

type MeResponse = {
  user: { id: number; email: string; role: string; dailyQuota: number } | null;
  remainingQuota?: number;
};

export default function DashboardPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [meData, jobData] = await Promise.all([
        apiFetch<MeResponse>("/api/auth/me"),
        apiFetch<{ items: PublicJob[] }>("/api/image-jobs")
      ]);
      setMe(meData);
      setJobs(jobData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  useEffect(() => {
    void load();
  }, []);

  if (me && !me.user) {
    return (
      <main className="card" style={{ padding: "2rem" }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3rem" }}>需要登录</h1>
        <Link className="button" href="/login">去登录</Link>
      </main>
    );
  }

  return (
    <main className="grid" style={{ paddingBottom: "4rem" }}>
      <section className="card" style={{ padding: "2rem" }}>
        <div className="grid two">
          <div>
            <p className="muted">Dashboard</p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "4rem", lineHeight: 1 }}>生成任务</h1>
            <p className="muted">{me?.user?.email ?? "加载中..."}</p>
          </div>
          <div className="grid">
            <div className="card" style={{ padding: "1.25rem", background: "rgba(46,111,104,0.12)" }}>
              <p className="muted">今日剩余额度</p>
              <strong style={{ fontSize: "2.4rem" }}>{me?.remainingQuota ?? "-"}</strong>
            </div>
            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <Link className="button" href="/generate">生成图片</Link>
              <button className="button secondary" onClick={logout}>退出</button>
            </div>
          </div>
        </div>
      </section>

      {error ? <p style={{ color: "#9b2c1f" }}>{error}</p> : null}

      <section className="card" style={{ padding: "2rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem" }}>最近任务</h2>
        {jobs.length === 0 ? <p className="muted">暂无任务。</p> : null}
        {jobs.map((job) => (
          <div className="list-row" key={job.id}>
            <div>
              <span className="status">{job.status}</span>
              <p style={{ margin: "0.6rem 0 0" }}>{job.prompt.slice(0, 160)}</p>
              <p className="muted">{job.size} / {job.quality}</p>
            </div>
            <Link className="button secondary" href={`/jobs/${job.id}`}>查看</Link>
          </div>
        ))}
      </section>
    </main>
  );
}
