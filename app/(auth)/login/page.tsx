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
      const data = await apiFetch<{ user: { role: "USER" | "ADMIN" } }>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken })
      });
      router.replace(data.user.role === "ADMIN" ? "/admin" : "/generate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setTurnstileToken("");
      setTurnstileKey((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-panel card" onSubmit={submit}>
      <div className="auth-form-header">
        <h2>登录</h2>
        <p className="muted">使用账号进入图像生成体验站。</p>
      </div>
      <label className="auth-field">
        <span>邮箱</span>
        <input className="input" placeholder="邮箱地址" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className="auth-field">
        <span>密码</span>
        <input className="input" placeholder="输入密码" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>
      <Turnstile key={turnstileKey} action="login" onToken={setTurnstileToken} />
      {error ? <p className="error-text">{error}</p> : null}
      <button className="button auth-submit" disabled={loading}>
        {loading ? "登录中..." : "登录"}
      </button>
      <p className="muted auth-link-row">
        没有账号？ <Link href="/register" prefetch>使用邀请码注册</Link>
      </p>
    </form>
  );
}
