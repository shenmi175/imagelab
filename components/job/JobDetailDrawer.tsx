"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { PublicJob } from "@/components/api";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { JobTimeline } from "@/components/job/JobTimeline";
import { jobModeLabel, outputFormatLabel, qualityLabel } from "@/lib/status-labels";

export function JobDetailDrawer({
  job,
  onClose,
  onRerun
}: {
  job: PublicJob | null;
  onClose: () => void;
  onRerun?: (job: PublicJob) => void;
}) {
  if (!job) return null;

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="drawer card" role="dialog" aria-modal="true" aria-label="任务详情" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <h2>任务详情</h2>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid">
          <JobStatusBadge job={job} />
          <p>{job.prompt}</p>
          <p className="muted">
            {jobModeLabel(job.mode, job.inputImageCount)} / {job.size} / {qualityLabel(job.quality)} / {outputFormatLabel(job.outputFormat)}{job.outputCompression !== null && job.outputCompression !== undefined ? ` / 压缩 ${job.outputCompression}` : ""} / 第 {job.attempts} 次尝试
          </p>
          {job.displayError ? <p className="error-text">{job.displayError}</p> : null}
          <JobTimeline job={job} />

          {job.imageUrl ? <img className="preview" src={job.imageUrl} alt={job.prompt} decoding="async" /> : <div className="empty-preview">图片还在生成中</div>}

          <div className="action-row">
            {job.downloadUrl ? <a className="button" href={job.downloadUrl}>下载图片</a> : null}
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(job.prompt)}>复制提示词</Button>
            <FeedbackButton imageJobId={job.id} defaultType={job.status === "FAILED" ? "GENERATION_FAILED" : "GENERAL"} label="反馈" />
            {onRerun ? <Button type="button" variant="outline" onClick={() => onRerun(job)}>重新生成</Button> : null}
            <Link className="button secondary" href={`/jobs/${job.id}`}>打开详情页</Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
