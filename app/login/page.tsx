"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/components/api";
import { Turnstile } from "@/components/Turnstile";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken })
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setTurnstileToken("");
      setTurnstileKey((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="hero">
      <section className="card" style={{ padding: "2rem" }}>
        <p className="muted">Private beta</p>
        <h1 className="hero-title">Login to make images.</h1>
        <p className="muted" style={{ fontSize: "1.05rem", maxWidth: 560 }}>
          任务会进入后台队列，不会让浏览器等待长时间请求。
        </p>
      </section>
      <form className="card grid" style={{ padding: "2rem", alignSelf: "center" }} onSubmit={submit}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem" }}>登录</h2>
        <input className="input" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="input" placeholder="密码" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <Turnstile key={turnstileKey} action="login" onToken={setTurnstileToken} />
        {error ? <p style={{ color: "#9b2c1f" }}>{error}</p> : null}
        <button className="button" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </button>
        <p className="muted">
          没有账号？ <Link href="/register">使用邀请码注册</Link>
        </p>
      </form>
    </main>
  );
}
