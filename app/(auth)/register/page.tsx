"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/components/api";
import { AuthOceanVisual } from "@/components/auth/AuthOceanVisual";
import { Turnstile } from "@/components/Turnstile";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, inviteCode, turnstileToken })
      });
      window.location.assign("/generate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
      setTurnstileToken("");
      setTurnstileKey((current) => current + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-experience">
      <AuthOceanVisual
        eyebrow="邀请注册"
        title={
          <>
            使用邀请码
            <br />
            开始创作
          </>
        }
        meta="私有工作台"
      />

      <form className="auth-panel card" onSubmit={submit}>
        <div className="auth-form-header">
          <h2>注册</h2>
          <p className="muted">输入邀请码创建体验站账号。</p>
        </div>
        <label className="auth-field">
          <span>邮箱</span>
          <input className="input" placeholder="邮箱地址" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>密码</span>
          <input className="input" placeholder="至少 8 位" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <label className="auth-field">
          <span>邀请码</span>
          <input className="input" placeholder="输入邀请码" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required />
        </label>
        <Turnstile key={turnstileKey} action="register" onToken={setTurnstileToken} />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="button auth-submit" disabled={loading}>
          {loading ? "注册中..." : "注册"}
        </button>
        <p className="muted auth-link-row">
          已有账号？ <Link href="/login">登录</Link>
        </p>
      </form>
    </main>
  );
}
