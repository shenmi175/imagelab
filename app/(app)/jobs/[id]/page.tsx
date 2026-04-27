"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, RotateCcw } from "lucide-react";
import { apiFetch, PublicJob } from "@/components/api";
import { FeedbackButton } from "@/components/app/FeedbackButton";
import { StorageNotice } from "@/components/app/StorageNotice";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { JobTimeline } from "@/components/job/JobTimeline";
import { JobTimer } from "@/components/job/JobTimer";
import { jobModeLabel, outputFormatLabel, qualityLabel, terminalStatuses } from "@/lib/status-labels";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const jobQuery = useQuery({
    queryKey: ["job", params.id],
    queryFn: () => apiFetch<PublicJob>(`/api/image-jobs/${params.id}`),
    refetchInterval: (query) => {
      const job = query.state.data as PublicJob | undefined;
      if (job && terminalStatuses.has(job.status)) return false;
      if (typeof document === "undefined") return false;
      return document.visibilityState === "visible" ? 2500 : 10000;
    }
  });

  const rerunMutation = useMutation({
    mutationFn: (job: PublicJob) => apiFetch<PublicJob>(`/api/image-jobs/${job.id}/rerun`, { method: "POST" }),
    onSuccess: (job) => {
      toast.success("已重新提交任务");
      queryClient.setQueryData(["job", job.id], job);
      router.replace(`/jobs/${job.id}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "重新生成失败")
  });

  const job = jobQuery.data;

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <Link className="muted" href="/jobs">返回任务列表</Link>
          <h1>任务详情</h1>
          <p className="muted">刷新页面后仍会根据 createdAt / startedAt / completedAt 计算耗时。</p>
        </div>
        {job ? <JobStatusBadge job={job} /> : null}
      </section>

      {jobQuery.error ? <p className="error-text">{jobQuery.error instanceof Error ? jobQuery.error.message : "加载失败"}</p> : null}

      {job ? (
        <section className="job-detail-grid">
          <div className="card panel-section">
            <div className="grid">
              <StorageNotice />
              <JobTimer job={job} />
              <p>{job.prompt}</p>
              <p className="muted">
                {jobModeLabel(job.mode, job.inputImageCount)} / {job.size} / {qualityLabel(job.quality)} / {outputFormatLabel(job.outputFormat)}{job.outputCompression !== null && job.outputCompression !== undefined ? ` / 压缩 ${job.outputCompression}` : ""} / 第 {job.attempts} 次尝试
              </p>
              {job.displayError ? <p className="error-text">{job.displayError}</p> : null}
              <JobTimeline job={job} />
              <div className="action-row">
                {job.downloadUrl ? <a className="button" href={job.downloadUrl}>下载图片</a> : null}
                <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(job.prompt)}>
                  <Copy className="h-4 w-4" />
                  复制提示词
                </Button>
                <Button type="button" variant="outline" onClick={() => rerunMutation.mutate(job)}>
                  <RotateCcw className="h-4 w-4" />
                  重新生成
                </Button>
                <FeedbackButton imageJobId={job.id} defaultType={job.status === "FAILED" ? "GENERATION_FAILED" : "GENERAL"} label="反馈" />
              </div>
            </div>
          </div>

          <div className="card result-panel">
            {job.imageUrl ? (
              <img className="preview" src={job.imageUrl} alt={job.prompt} decoding="async" />
            ) : (
              <div className="empty-preview tall">
                <RotateCcw className="h-5 w-5" />
                <p>{job.statusLabel}，页面会自动刷新。</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="card panel-section">
          <p className="muted">加载中...</p>
        </section>
      )}
    </main>
  );
}
