"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, Copy, ImagePlus, RotateCcw, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { apiFetch, PublicJob } from "@/components/api";
import { StorageNotice } from "@/components/app/StorageNotice";
import { Button } from "@/components/ui/button";
import { JobStatusBadge } from "@/components/job/JobStatusBadge";
import { JobTimeline } from "@/components/job/JobTimeline";
import { JobTimer } from "@/components/job/JobTimer";
import { jobModeLabel, outputFormatLabel, qualityLabel, terminalStatuses } from "@/lib/status-labels";

const promptTemplates = [
  "制作一张关于濒危动物的视觉信息丰富的信息图，中心是一只近乎照片写实的雪豹，周围有栖息地、食性、威胁和保护行动标注。",
  "一张高端咖啡豆品牌的产品海报，黄昏暖光、陶瓷杯、咖啡豆飞散，构图有强烈层次和可商用质感。",
  "未来城市夜景概念图，雨后街道、霓虹倒影、无人驾驶巴士、干净但具有电影感的环境设计。"
];

const maxInputImages = 4;

const sizes = [
  { value: "1024x1024", label: "方图", description: "社媒封面 / 通用预览" },
  { value: "1536x1024", label: "横图", description: "海报 / 横幅 / 桌面图" },
  { value: "1024x1536", label: "竖图", description: "手机壁纸 / 小红书图文" },
  { value: "2048x2048", label: "高清方图", description: "细节更足的方形图" },
  { value: "2048x1152", label: "高清横图", description: "宽屏封面 / 展示图" },
  { value: "3840x2160", label: "超清横图", description: "大屏展示 / 细节输出" },
  { value: "2160x3840", label: "超清竖图", description: "竖版海报 / 手机壁纸" },
  { value: "auto", label: "自动", description: "由模型自动选择尺寸" }
];

const qualities = [
  { value: "low", label: "草稿", description: "更快，适合草稿" },
  { value: "medium", label: "标准", description: "平衡速度和质量" },
  { value: "high", label: "精细", description: "更细节，通常更慢" },
  { value: "auto", label: "自动", description: "由模型自动决定" }
];

const outputFormats = [
  { value: "png", label: "无损图", description: "适合通用下载" },
  { value: "jpeg", label: "压缩图", description: "文件更小" }
];

const backgrounds = [
  { value: "auto", label: "自动", description: "自动" },
  { value: "opaque", label: "不透明", description: "不透明" }
];

const moderations = [
  { value: "auto", label: "自动", description: "默认" },
  { value: "low", label: "宽松", description: "较宽松" }
];

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

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
  const [outputFormat, setOutputFormat] = useState("png");
  const [outputCompression, setOutputCompression] = useState(75);
  const [background, setBackground] = useState("auto");
  const [moderation, setModeration] = useState("auto");
  const [inputImages, setInputImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const jobQuery = useJob(activeJobId);
  const activeJob = jobQuery.data ?? null;

  useEffect(() => {
    const initialPrompt = new URLSearchParams(window.location.search).get("prompt");
    if (initialPrompt) setPrompt(initialPrompt);
  }, []);

  useEffect(() => {
    const urls = inputImages.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [inputImages]);

  const createMutation = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.set("prompt", prompt);
      formData.set("size", size);
      formData.set("quality", quality);
      formData.set("output_format", outputFormat);
      if (outputFormat === "jpeg") formData.set("output_compression", String(outputCompression));
      formData.set("background", background);
      formData.set("moderation", moderation);
      inputImages.forEach((file) => formData.append("image[]", file));
      return apiFetch<PublicJob>("/api/image-jobs", {
        method: "POST",
        body: formData
      });
    },
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
      toast.error("提示词不能为空");
      return;
    }
    createMutation.mutate();
  }

  function selectImages(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;

    setInputImages((current) => {
      const existing = new Set(current.map(fileKey));
      const next = [...current];

      for (const file of selected) {
        const key = fileKey(file);
        if (existing.has(key)) continue;
        if (next.length >= maxInputImages) break;
        existing.add(key);
        next.push(file);
      }

      return next;
    });

    if (inputImages.length + selected.length > maxInputImages) {
      toast.warning(`最多上传 ${maxInputImages} 张参考图`);
    }
  }

  const selectedSize = sizes.find((item) => item.value === size);
  const selectedQuality = qualities.find((item) => item.value === quality);
  const selectedFormat = outputFormats.find((item) => item.value === outputFormat);

  return (
    <main className="generate-workspace">
      <aside className="template-rail card">
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
            <h1>描述你要生成的图片</h1>
          </div>
          <Button type="button" variant="ghost" onClick={() => setPrompt("")}>清空</Button>
        </div>

        <form className="grid" onSubmit={submit}>
          <StorageNotice />
          <div className="prompt-editor">
            <textarea
              className="textarea"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：大胆图形插画风格的信息图，主体近乎照片写实，周围有结构化标注..."
            />
            <div className="prompt-toolbar" aria-label="生成参数">
              <label className="prompt-upload">
                <ImagePlus className="h-4 w-4" />
                <span>{inputImages.length ? `${inputImages.length} 图` : "参考图"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={(event) => {
                    selectImages(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              <label className="inline-field">
                <span>分辨率</span>
                <select value={size} onChange={(event) => setSize(event.target.value)}>
                  {sizes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label} {item.value}</option>
                  ))}
                </select>
              </label>

              <label className="inline-field">
                <span>质量</span>
                <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                  {qualities.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="inline-field">
                <span>审核</span>
                <select value={moderation} onChange={(event) => setModeration(event.target.value)}>
                  {moderations.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="inline-field">
                <span>格式</span>
                <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
                  {outputFormats.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <label className="inline-field">
                <span>背景</span>
                <select value={background} onChange={(event) => setBackground(event.target.value)}>
                  {backgrounds.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <span className={prompt.length > 1800 ? "char-count warning" : "char-count"}>{prompt.length} / 2000</span>
              <Button className="prompt-submit" type="submit" disabled={createMutation.isPending || !prompt.trim() || prompt.length > 2000}>
                <Sparkles className="h-4 w-4" />
                {createMutation.isPending ? "提交中..." : inputImages.length ? "提交编辑" : "提交生成"}
              </Button>
            </div>
          </div>

          <details className="parameter-accordion">
            <summary>
              <span>
                <SlidersHorizontal className="h-4 w-4" />
                完整参数
              </span>
              <small>
                {selectedSize?.label ?? size} / {selectedQuality?.label ?? quality} / {selectedFormat?.label ?? outputFormat}
              </small>
              <ChevronDown className="accordion-icon h-4 w-4" />
            </summary>

            <div className="parameter-accordion-body">
              <div className="parameter-grid">
                <div className="parameter-group wide">
                  <p className="muted">尺寸</p>
                  <div className="option-grid size-option-grid">
                    {sizes.map((item) => (
                      <button type="button" className={size === item.value ? "option-card active" : "option-card"} key={item.value} onClick={() => setSize(item.value)}>
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                        <small>{item.description}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="parameter-group wide">
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

              <div className="advanced-parameters">
                <div className="section-heading compact">
                  <div>
                    <h2>输出参数</h2>
                  </div>
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="parameter-grid compact">
                  <div className="parameter-group">
                    <p className="muted">格式</p>
                    <div className="option-grid compact">
                      {outputFormats.map((item) => (
                        <button type="button" className={outputFormat === item.value ? "option-card compact active" : "option-card compact"} key={item.value} onClick={() => setOutputFormat(item.value)}>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={outputFormat === "jpeg" ? "parameter-group" : "parameter-group disabled"}>
                    <p className="muted">压缩率</p>
                    <div className="range-control">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={outputCompression}
                        disabled={outputFormat !== "jpeg"}
                        onChange={(event) => setOutputCompression(Number(event.target.value))}
                      />
                      <input
                        className="number-input"
                        type="number"
                        min="0"
                        max="100"
                        value={outputCompression}
                        disabled={outputFormat !== "jpeg"}
                        onChange={(event) => setOutputCompression(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
                      />
                    </div>
                  </div>

                  <div className="parameter-group">
                    <p className="muted">背景</p>
                    <div className="option-grid compact">
                      {backgrounds.map((item) => (
                        <button type="button" className={background === item.value ? "option-card compact active" : "option-card compact"} key={item.value} onClick={() => setBackground(item.value)}>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="parameter-group">
                    <p className="muted">审核</p>
                    <div className="option-grid compact">
                      {moderations.map((item) => (
                        <button type="button" className={moderation === item.value ? "option-card compact active" : "option-card compact"} key={item.value} onClick={() => setModeration(item.value)}>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="upload-panel">
                <div>
                  <p className="muted">参考图 / 编辑图</p>
                  <strong>{inputImages.length ? `已选择 ${inputImages.length} 张图片` : "可选上传，上传后自动走图像编辑接口"}</strong>
                </div>
                <label className="upload-drop">
                  <ImagePlus className="h-5 w-5" />
                  <span>选择常见图片格式，最多 4 张</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => {
                      selectImages(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {previewUrls.length ? (
                  <div className="upload-preview-grid">
                    {previewUrls.map((url, index) => (
                      <div className="upload-preview" key={url}>
                        <img src={url} alt={`参考图 ${index + 1}`} decoding="async" />
                        <button
                          type="button"
                          aria-label="移除图片"
                          onClick={() => setInputImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </details>

          {activeJob ? (
            <div className="action-row">
              <Link className="button secondary" href={`/jobs/${activeJob.id}`}>
                打开详情
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : null}
        </form>
      </section>

      <aside className="status-panel card">
        <div className="section-heading">
          <div>
            <h2>生成状态</h2>
          </div>
          {activeJob ? <JobStatusBadge job={activeJob} /> : null}
        </div>

        {activeJob ? (
          <div className="grid">
            <JobTimer job={activeJob} />
            <p className="muted">任务类型：{jobModeLabel(activeJob.mode, activeJob.inputImageCount)}</p>
            <p className="muted">{activeJob.size} / {qualityLabel(activeJob.quality)} / {outputFormatLabel(activeJob.outputFormat)}{activeJob.outputCompression !== null && activeJob.outputCompression !== undefined ? ` / 压缩 ${activeJob.outputCompression}` : ""}</p>
            <p className="muted">图片生成通常需要几十秒到数分钟，页面会自动刷新状态。</p>
            <StorageNotice compact />
            {activeJob.displayError ? <p className="error-text">{activeJob.displayError}</p> : null}
            <JobTimeline job={activeJob} />
            {activeJob.imageUrl ? (
              <img className="preview" src={activeJob.imageUrl} alt={activeJob.prompt} decoding="async" />
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
                复制提示词
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
