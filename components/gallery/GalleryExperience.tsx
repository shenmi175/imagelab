"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, RefreshCw, Sparkles } from "lucide-react";
import { apiFetch, PublicJob } from "@/components/api";
import { Button } from "@/components/ui/button";
import { JobDetailDrawer } from "@/components/job/JobDetailDrawer";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { JobTimer } from "@/components/job/JobTimer";
import { formatDateTime, formatDuration } from "@/lib/duration";
import { terminalStatuses } from "@/lib/status-labels";

const filters = [
  { value: "", label: "全部" },
  { value: "QUEUED", label: "排队中" },
  { value: "RUNNING", label: "生成中" },
  { value: "COMPLETED", label: "已完成" },
  { value: "FAILED", label: "失败" },
  { value: "EXPIRED", label: "已过期" }
];

const emptyPrompts = [
  "一张关于深海生物的高信息密度视觉图谱，中心主体近乎照片写实，周围用标注解释生态位。",
  "复古旅行海报风格的香港夜景，雨后街道、霓虹倒影、强烈图形构成。",
  "专业产品摄影，一只透明香水瓶置于水波纹和柔光背景中，画面克制高级。"
];

export function GalleryExperience({ mode = "gallery" }: { mode?: "gallery" | "jobs" }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [selectedJob, setSelectedJob] = useState<PublicJob | null>(null);

  const queryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    const suffix = params.toString();
    return `/api/image-jobs${suffix ? `?${suffix}` : ""}`;
  }, [status]);

  const jobsQuery = useQuery({
    queryKey: ["image-jobs", status],
    queryFn: () => apiFetch<{ items: PublicJob[] }>(queryUrl),
    refetchInterval: (query) => {
      const data = query.state.data as { items: PublicJob[] } | undefined;
      const hasActive = data?.items.some((job) => !terminalStatuses.has(job.status));
      if (typeof document === "undefined") return false;
      return hasActive ? 3000 : false;
    }
  });

  const rerunMutation = useMutation({
    mutationFn: (job: PublicJob) => apiFetch<PublicJob>(`/api/image-jobs/${job.id}/rerun`, { method: "POST" }),
    onSuccess: (job) => {
      toast.success("已重新提交任务");
      setSelectedJob(job);
      queryClient.invalidateQueries({ queryKey: ["image-jobs"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "重新生成失败")
  });

  const jobs = jobsQuery.data?.items ?? [];
  const completedCount = jobs.filter((job) => job.status === "COMPLETED").length;

  function copyPrompt(job: PublicJob) {
    navigator.clipboard.writeText(job.prompt);
    toast.success("Prompt 已复制");
  }

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <p className="muted">{mode === "gallery" ? "Gallery" : "Jobs"}</p>
          <h1>{mode === "gallery" ? "图片图库" : "任务列表"}</h1>
          <p className="muted">
            {mode === "gallery" ? `已加载 ${jobs.length} 个任务，其中 ${completedCount} 张图片可查看。` : "查看所有任务状态、耗时和失败原因。"}
          </p>
        </div>
        <Link className="button" href="/generate">
          <Sparkles className="h-4 w-4" />
          生成新图片
        </Link>
      </section>

      <div className="filter-pills">
        {filters.map((filter) => (
          <button className={status === filter.value ? "filter-pill active" : "filter-pill"} key={filter.value} onClick={() => setStatus(filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>

      {jobsQuery.isLoading ? <p className="muted">加载中...</p> : null}
      {jobsQuery.error ? <p className="error-text">{jobsQuery.error instanceof Error ? jobsQuery.error.message : "加载失败"}</p> : null}

      {jobs.length === 0 && !jobsQuery.isLoading ? (
        <section className="card empty-state">
          <h2>还没有图片</h2>
          <p className="muted">先生成第一张图，图库会自动保存历史任务、耗时和下载入口。</p>
          <div className="template-list">
            {emptyPrompts.map((prompt) => (
              <Link href={`/generate?prompt=${encodeURIComponent(prompt)}`} key={prompt}>
                {prompt}
              </Link>
            ))}
          </div>
        </section>
      ) : mode === "gallery" ? (
        <section className="gallery-grid">
          {jobs.map((job) => (
            <article className="gallery-card card" key={job.id} onClick={() => setSelectedJob(job)}>
              {job.imageUrl ? <img src={job.imageUrl} alt={job.prompt} /> : <div className="gallery-placeholder">{job.statusLabel}</div>}
              <div className="gallery-card-body">
                <div className="section-heading compact">
                  <JobStatusBadge job={job} />
                  <span className="muted">{formatDuration(job.generationDurationMs)}</span>
                </div>
                <p>{job.prompt.slice(0, 96)}</p>
                <p className="muted">{job.mode === "EDIT" ? `编辑 / 参考图 ${job.inputImageCount}` : "文生图"} / {job.size} / {job.quality} / {formatDateTime(job.createdAt)}</p>
                <div className="action-row" onClick={(event) => event.stopPropagation()}>
                  {job.downloadUrl ? (
                    <a className="icon-button" href={job.downloadUrl} aria-label="下载图片">
                      <Download className="h-4 w-4" />
                    </a>
                  ) : null}
                  <button className="icon-button" onClick={() => copyPrompt(job)} aria-label="复制 Prompt">
                    <Copy className="h-4 w-4" />
                  </button>
                  <button className="icon-button" onClick={() => rerunMutation.mutate(job)} aria-label="重新生成">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="card panel-section">
          <div className="table-list">
            {jobs.map((job) => (
              <button className="table-row task-row" key={job.id} onClick={() => setSelectedJob(job)}>
                <div>
                  <JobStatusBadge job={job} />
                  <p>{job.prompt.slice(0, 160)}</p>
                  <p className="muted">{job.mode === "EDIT" ? `编辑 / 参考图 ${job.inputImageCount}` : "文生图"} / {job.size} / {job.quality} / 创建 {formatDateTime(job.createdAt)}</p>
                  {job.displayError ? <p className="error-text">{job.displayError}</p> : null}
                </div>
                <div className="task-row-metrics">
                  <span className="muted">当前</span>
                  <strong><JobTimer job={job} compact /></strong>
                  <span className="muted">生成 {formatDuration(job.generationDurationMs)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} onRerun={(job) => rerunMutation.mutate(job)} />
    </main>
  );
}
