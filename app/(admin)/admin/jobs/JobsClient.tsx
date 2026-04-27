"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/components/api";
import { AdminJobList } from "@/components/admin/AdminJobList";
import { AdminStatusFilters } from "@/components/admin/AdminStatusFilters";
import type { AdminJob } from "@/components/admin/AdminTypes";
import { Input } from "@/components/ui/input";

export default function JobsClient() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
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
      const data = await apiFetch<{ items: AdminJob[] }>(`/api/admin/image-jobs${suffix}`);
      setJobs(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
  }, [queryString]);

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <p className="muted">Job operations</p>
          <h1>任务管理</h1>
          <p className="muted">集中查看任务状态、上游错误、耗时和删除异常或过期图片。</p>
        </div>
      </section>

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <p className="muted">Jobs</p>
            <h2>任务列表</h2>
          </div>
          <div className="search-box">
            <Search className="h-4 w-4" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索邮箱 / Prompt / Job ID" />
          </div>
        </div>
        <AdminStatusFilters status={status} onChange={setStatus} />
        {error ? <p className="error-text">{error}</p> : null}
        <AdminJobList jobs={jobs} onReload={load} emptyText="暂无任务。" />
      </section>
    </main>
  );
}
