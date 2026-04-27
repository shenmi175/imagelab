"use client";

import { Copy } from "lucide-react";
import { apiFetch } from "@/components/api";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { formatDuration } from "@/lib/duration";
import { errorCodeLabel, jobModeLabel, outputFormatLabel, qualityLabel } from "@/lib/status-labels";
import type { AdminJob } from "@/components/admin/AdminTypes";

export function AdminJobList({
  jobs,
  onReload,
  emptyText = "暂无任务。"
}: {
  jobs: AdminJob[];
  onReload: () => Promise<void> | void;
  emptyText?: string;
}) {
  async function deleteJob(id: string) {
    if (!confirm("确定删除该任务、原图、缩略图和上传参考图？")) return;
    await apiFetch(`/api/admin/image-jobs/${id}`, { method: "DELETE" });
    await onReload();
  }

  if (jobs.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="table-list">
      {jobs.map((job) => (
        <div className="table-row admin-job-row" key={job.id}>
          <div className="admin-job-preview">
            {job.thumbnailUrl ? (
              <a href={job.imageUrl ?? job.thumbnailUrl} target="_blank" rel="noreferrer">
                <img src={job.thumbnailUrl} alt={job.prompt} loading="lazy" decoding="async" />
              </a>
            ) : (
              <span>{job.statusLabel}</span>
            )}
          </div>
          <div>
            <JobStatusBadge job={job} />
            <p>{job.prompt.slice(0, 180)}</p>
            <p className="muted">
              {job.userEmail} / {jobModeLabel(job.mode, job.inputImageCount)} / {job.size} / {qualityLabel(job.quality)} / {outputFormatLabel(job.outputFormat)} / {errorCodeLabel(job.errorCode)} / 上游 {job.upstreamStatus ?? "-"} / 生成 {formatDuration(job.generationDurationMs)}
            </p>
            {job.upstreamRequestId ? <p className="muted">请求 {job.upstreamRequestId}</p> : null}
          </div>
          <div className="action-row">
            <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(job.id)} aria-label="复制任务编号">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="destructive" onClick={() => deleteJob(job.id)}>删除图片</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
