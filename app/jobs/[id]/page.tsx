"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, PublicJob } from "@/components/api";

const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELED", "EXPIRED"]);

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await apiFetch<PublicJob>(`/api/image-jobs/${params.id}`);
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!job || !terminalStatuses.has(job.status)) void load();
    }, document.visibilityState === "visible" ? 3000 : 15000);
    return () => clearInterval(timer);
  }, [params.id, job?.status]);

  return (
    <main className="grid" style={{ paddingBottom: "4rem" }}>
      <section className="card" style={{ padding: "2rem" }}>
        <Link className="muted" href="/dashboard">返回任务列表</Link>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "3.5rem", lineHeight: 1 }}>任务详情</h1>
        {error ? <p style={{ color: "#9b2c1f" }}>{error}</p> : null}
        {job ? (
          <div className="grid two">
            <div className="grid">
              <p><span className="status">{job.status}</span></p>
              <p>{job.prompt}</p>
              <p className="muted">{job.model} / {job.size} / {job.quality} / attempts {job.attempts}</p>
              {job.errorMessage ? <p style={{ color: "#9b2c1f" }}>{job.errorMessage}</p> : null}
              {job.downloadUrl ? <a className="button" href={job.downloadUrl}>下载图片</a> : null}
            </div>
            <div>
              {job.imageUrl ? (
                <img className="preview" src={job.imageUrl} alt={job.prompt} />
              ) : (
                <div className="card" style={{ minHeight: 360, display: "grid", placeItems: "center" }}>
                  <p className="muted">图片生成中，页面会自动刷新状态。</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="muted">加载中...</p>
        )}
      </section>
    </main>
  );
}
