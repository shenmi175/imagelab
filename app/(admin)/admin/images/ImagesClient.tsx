"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/components/api";
import { AdminJobList } from "@/components/admin/AdminJobList";
import { AdminStatusFilters } from "@/components/admin/AdminStatusFilters";
import { Input } from "@/components/ui/input";
import type { AdminJob } from "@/components/admin/AdminTypes";

export default function ImagesClient({ initialUserId, initialEmail }: { initialUserId?: string; initialEmail?: string }) {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState(initialUserId ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search.trim()) params.set("q", search.trim());
    if (userId) params.set("userId", userId);
    return params.toString();
  }, [search, status, userId]);

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

  function clearUser() {
    setUserId("");
    setEmail("");
  }

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <h1>用户图片</h1>
          <p className="muted">按用户查看生成图片、打开预览并删除图片文件。</p>
        </div>
        <Link className="button secondary" href="/admin">返回用户管理</Link>
      </section>

      {email || userId ? (
        <div className="storage-notice compact">
          <strong>当前用户：{email || userId}</strong>
          <span>
            只显示该用户的任务。
            <button className="inline-action" type="button" onClick={clearUser}>
              <X className="h-3 w-3" />
              查看全部用户
            </button>
          </span>
        </div>
      ) : null}

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <h2>图片列表</h2>
          </div>
          <div className="search-box">
            <Search className="h-4 w-4" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索邮箱 / 提示词 / 任务编号" />
          </div>
        </div>
        <AdminStatusFilters status={status} onChange={setStatus} />
        {error ? <p className="error-text">{error}</p> : null}
        <AdminJobList jobs={jobs} onReload={load} emptyText="暂无图片任务。" />
      </section>
    </main>
  );
}
