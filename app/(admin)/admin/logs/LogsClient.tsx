"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { apiFetch, type AdminUsageLog } from "@/components/api";
import { Input } from "@/components/ui/input";
import { errorCodeLabel, logActionLabel, logStatusLabel, statusLabel } from "@/lib/status-labels";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

export default function LogsClient() {
  const [items, setItems] = useState<AdminUsageLog[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (action.trim()) params.set("action", action.trim());
    if (status.trim()) params.set("status", status.trim());
    return params.toString();
  }, [action, search, status]);

  async function load() {
    try {
      const suffix = queryString ? `?${queryString}` : "";
      const data = await apiFetch<{ items: AdminUsageLog[] }>(`/api/admin/logs${suffix}`);
      setItems(data.items);
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
          <h1>操作日志</h1>
          <p className="muted">查看登录、注册、任务、下载、管理员操作和反馈提交记录。</p>
        </div>
      </section>

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <h2>最近日志</h2>
          </div>
          <div className="search-box">
            <Search className="h-4 w-4" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索邮箱 / 操作 / 详情 / 任务编号" />
          </div>
        </div>

        <div className="log-filters">
          <Input value={action} onChange={(event) => setAction(event.target.value)} placeholder="操作类型" />
          <Input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="状态" />
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="table-list">
          {items.length ? (
            items.map((item) => (
              <article className="table-row log-row" key={item.id}>
                <div>
                  <div className="log-row-head">
                    <strong>{logActionLabel(item.action)}</strong>
                    <span className={`log-status ${item.status.toLowerCase()}`}>{logStatusLabel(item.status)}</span>
                    <span className="muted">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <p className="muted">{item.user.email}{item.imageJobId ? ` / 任务 ${item.imageJobId}` : ""}</p>
                  {item.detail ? <pre className="log-detail">{item.detail}</pre> : null}
                  {item.imageJob ? (
                    <p className="muted">
                      任务 {statusLabel(item.imageJob.status)} / {errorCodeLabel(item.imageJob.errorCode)} / {item.imageJob.prompt.slice(0, 100)}
                    </p>
                  ) : null}
                </div>
                {item.imageJobId ? <Link className="inline-action" href={`/admin/images?q=${encodeURIComponent(item.imageJobId)}`}>查看任务</Link> : null}
              </article>
            ))
          ) : (
            <p className="muted">暂无日志。</p>
          )}
        </div>
      </section>
    </main>
  );
}
