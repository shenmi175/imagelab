"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Copy, RotateCcw, Sparkles } from "lucide-react";
import { apiFetch, PublicJob } from "@/components/api";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { JobTimeline } from "@/components/job/JobTimeline";
import { JobTimer } from "@/components/job/JobTimer";
import { terminalStatuses } from "@/lib/status-labels";

const promptTemplates = [
  "制作一张关于濒危动物的视觉信息丰富的信息图，中心是一只近乎照片写实的雪豹，周围有栖息地、食性、威胁和保护行动标注。",
  "一张高端咖啡豆品牌的产品海报，黄昏暖光、陶瓷杯、咖啡豆飞散，构图有强烈层次和可商用质感。",
  "未来城市夜景概念图，雨后街道、霓虹倒影、无人驾驶巴士、干净但具有电影感的环境设计。"
];

const sizes = [
  { value: "1024x1024", label: "方图", description: "社媒封面 / 通用预览" },
  { value: "1536x1024", label: "横图", description: "海报 / Banner / 桌面图" },
  { value: "1024x1536", label: "竖图", description: "手机壁纸 / 小红书图文" }
];

const qualities = [
  { value: "low", label: "Low", description: "更快，适合草稿" },
  { value: "medium", label: "Medium", description: "平衡速度和质量" },
  { value: "high", label: "High", description: "更细节，通常更慢" }
];

function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: () => apiFetch<PublicJob>(`/api/image-jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const job = query.state.data as PublicJob | undefined;
      if (job && terminalStatuses.has(job.status)) return false;
      if (typeof document === "undefined") return false;
      return document.visibilityState === "visible" ? 2500 : 10000;
    }
  });
}

export default function GeneratePage() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("high");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobQuery = useJob(activeJobId);
  const activeJob = jobQuery.data ?? null;

  useEffect(() => {
    const initialPrompt = new URLSearchParams(window.location.search).get("prompt");
    if (initialPrompt) setPrompt(initialPrompt);
  }, []);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<PublicJob>("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size, quality })
      }),
    onSuccess: (job) => {
      setActiveJobId(job.id);
      queryClient.setQueryData(["job", job.id], job);
      toast.success("任务已创建，正在进入队列");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "创建任务失败");
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) {
      toast.error("Prompt 不能为空");
      return;
    }
    createMutation.mutate();
  }

  return (
    <main className="generate-workspace">
      <aside className="template-rail card">
        <p className="muted">Prompt templates</p>
        <h2>快速开始</h2>
        <div className="template-list">
          {promptTemplates.map((template) => (
            <button type="button" key={template} onClick={() => setPrompt(template)}>
              {template}
            </button>
          ))}
        </div>
      </aside>

      <section className="creator-panel card">
        <div className="section-heading">
          <div>
            <p className="muted">Create</p>
            <h1>描述你要生成的图片</h1>
          </div>
          <Button type="button" variant="ghost" onClick={() => setPrompt("")}>清空</Button>
        </div>

        <form className="grid" onSubmit={submit}>
          <label className="prompt-editor">
            <textarea
              className="textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：大胆图形插画风格的信息图，主体近乎照片写实，周围有结构化标注..."
            />
            <span className={prompt.length > 1800 ? "char-count warning" : "char-count"}>{prompt.length} / 2000</span>
          </label>

          <div className="parameter-grid">
            <div>
              <p className="muted">尺寸</p>
              <div className="option-grid">
                {sizes.map((item) => (
                  <button type="button" className={size === item.value ? "option-card active" : "option-card"} key={item.value} onClick={() => setSize(item.value)}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="muted">质量</p>
              <div className="option-grid">
                {qualities.map((item) => (
                  <button type="button" className={quality === item.value ? "option-card active" : "option-card"} key={item.value} onClick={() => setQuality(item.value)}>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="action-row">
            <Button type="submit" size="lg" disabled={createMutation.isPending || !prompt.trim() || prompt.length > 2000}>
              <Sparkles className="h-4 w-4" />
              {createMutation.isPending ? "提交中..." : "提交生成"}
            </Button>
            {activeJob ? (
              <Link className="button secondary" href={`/jobs/${activeJob.id}`}>
                打开详情
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <aside className="status-panel card">
        <div className="section-heading">
          <div>
            <p className="muted">Current job</p>
            <h2>生成状态</h2>
          </div>
          {activeJob ? <JobStatusBadge job={activeJob} /> : null}
        </div>

        {activeJob ? (
          <div className="grid">
            <JobTimer job={activeJob} />
            <p className="muted">图片生成通常需要几十秒到数分钟，页面会自动刷新状态。</p>
            {activeJob.displayError ? <p className="error-text">{activeJob.displayError}</p> : null}
            <JobTimeline job={activeJob} />
            {activeJob.imageUrl ? (
              <img className="preview" src={activeJob.imageUrl} alt={activeJob.prompt} />
            ) : (
              <div className="empty-preview">
                <RotateCcw className="h-5 w-5" />
                {activeJob.statusLabel}
              </div>
            )}
            <div className="action-row">
              {activeJob.downloadUrl ? <a className="button" href={activeJob.downloadUrl}>下载图片</a> : null}
              <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(activeJob.prompt)}>
                <Copy className="h-4 w-4" />
                复制 Prompt
              </Button>
            </div>
          </div>
        ) : (
          <div className="empty-preview tall">
            <Sparkles className="h-6 w-6" />
            <p>提交任务后，这里会显示实时计时、队列阶段和结果预览。</p>
          </div>
        )}
      </aside>
    </main>
  );
}
