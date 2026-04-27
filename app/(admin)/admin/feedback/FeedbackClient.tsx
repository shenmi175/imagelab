"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, type AdminFeedback } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorCodeLabel, statusLabel } from "@/lib/status-labels";

const statusOptions = [
  { value: "", label: "全部" },
  { value: "OPEN", label: "待处理" },
  { value: "REVIEWING", label: "处理中" },
  { value: "RESOLVED", label: "已解决" },
  { value: "IGNORED", label: "已忽略" }
];

const typeLabels: Record<string, string> = {
  GENERAL: "一般反馈",
  BUG: "问题反馈",
  GENERATION_FAILED: "生成失败",
  BILLING: "额度问题",
  SUGGESTION: "功能建议"
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function FeedbackRow({ item, onUpdated }: { item: AdminFeedback; onUpdated: (feedback: AdminFeedback) => void }) {
  const [note, setNote] = useState(item.adminNote ?? "");
  const [pending, setPending] = useState(false);

  async function update(status?: AdminFeedback["status"]) {
    setPending(true);
    try {
      const data = await apiFetch<{ feedback: AdminFeedback }>(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note })
      });
      onUpdated(data.feedback);
      toast.success("反馈已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="feedback-row">
      <div className="feedback-row-main">
        <div className="feedback-row-head">
          <span className={`feedback-status ${item.status.toLowerCase()}`}>{statusOptions.find((option) => option.value === item.status)?.label ?? item.status}</span>
          <strong>{typeLabels[item.type] ?? item.type}</strong>
          <span className="muted">{formatDateTime(item.createdAt)}</span>
        </div>
        <p>{item.message}</p>
        <p className="muted">
          {item.user.email}
          {item.contact ? ` / ${item.contact}` : ""}
          {item.imageJobId ? ` / 任务 ${item.imageJobId}` : ""}
        </p>
        {item.imageJob ? (
          <p className="muted">
            任务 {statusLabel(item.imageJob.status)} / {errorCodeLabel(item.imageJob.errorCode)} / 上游 {item.imageJob.upstreamStatus ?? "-"}
            {item.imageJob.upstreamRequestId ? ` / 请求 ${item.imageJob.upstreamRequestId}` : ""}
          </p>
        ) : null}
        {item.pageUrl ? (
          <a className="inline-action" href={item.pageUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3" />
            打开来源页面
          </a>
        ) : null}
      </div>

      <div className="feedback-row-actions">
        <textarea className="textarea admin-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="处理备注" />
        <div className="action-row">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => update("REVIEWING")}>处理中</Button>
          <Button type="button" disabled={pending} onClick={() => update("RESOLVED")}>已解决</Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => update("IGNORED")}>忽略</Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => update()}>保存备注</Button>
        </div>
        {item.imageJobId ? <Link className="inline-action" href={`/admin/images?q=${encodeURIComponent(item.imageJobId)}`}>查看任务</Link> : null}
      </div>
    </article>
  );
}

export default function FeedbackClient() {
  const [items, setItems] = useState<AdminFeedback[]>([]);
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
      const data = await apiFetch<{ items: AdminFeedback[] }>(`/api/admin/feedback${suffix}`);
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  useEffect(() => {
    void load();
  }, [queryString]);

  function updateItem(feedback: AdminFeedback) {
    setItems((current) => current.map((item) => (item.id === feedback.id ? feedback : item)));
  }

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <h1>用户反馈</h1>
          <p className="muted">处理用户提交的问题、建议和失败任务反馈。</p>
        </div>
      </section>

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <h2>反馈列表</h2>
          </div>
          <div className="search-box">
            <Search className="h-4 w-4" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索邮箱 / 内容 / 任务编号" />
          </div>
        </div>

        <div className="filter-row">
          {statusOptions.map((option) => (
            <button className={status === option.value ? "filter-pill active" : "filter-pill"} key={option.value} onClick={() => setStatus(option.value)}>
              {option.label}
            </button>
          ))}
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        <div className="feedback-list">
          {items.length ? items.map((item) => <FeedbackRow item={item} key={item.id} onUpdated={updateItem} />) : <p className="muted">暂无反馈。</p>}
        </div>
      </section>
    </main>
  );
}
