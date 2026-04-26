"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch, PublicJob } from "@/components/api";

export default function GeneratePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("high");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const job = await apiFetch<PublicJob>("/api/image-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size, quality })
      });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建任务失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="hero">
      <section className="card" style={{ padding: "2rem" }}>
        <p className="muted">Async generation</p>
        <h1 className="hero-title">Describe the image.</h1>
        <p className="muted">
          请勿生成违法、色情、仇恨、暴力、侵犯隐私或版权的内容。任务会进入队列，完成后可下载。
        </p>
      </section>
      <form className="card grid" style={{ padding: "2rem" }} onSubmit={submit}>
        <label className="grid">
          <span>Prompt</span>
          <textarea className="textarea" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="A cinematic product photo of..." />
        </label>
        <div className="grid two">
          <label className="grid">
            <span>尺寸</span>
            <select className="select" value={size} onChange={(event) => setSize(event.target.value)}>
              <option value="1024x1024">1024x1024</option>
              <option value="1536x1024">1536x1024</option>
              <option value="1024x1536">1024x1536</option>
            </select>
          </label>
          <label className="grid">
            <span>质量</span>
            <select className="select" value={quality} onChange={(event) => setQuality(event.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>
        {error ? <p style={{ color: "#9b2c1f" }}>{error}</p> : null}
        <button className="button" disabled={loading}>{loading ? "提交中..." : "提交任务"}</button>
      </form>
    </main>
  );
}
