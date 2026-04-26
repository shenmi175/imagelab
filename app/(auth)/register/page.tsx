"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/components/api";
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
    <main className="hero">
      <section className="card" style={{ padding: "2rem" }}>
        <p className="muted">Invite only</p>
        <h1 className="hero-title">Start with a code.</h1>
        <p className="muted">注册需要邀请码，用于控制免费体验站的滥用风险。</p>
      </section>
      <form className="card grid" style={{ padding: "2rem", alignSelf: "center" }} onSubmit={submit}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem" }}>注册</h2>
        <input className="input" placeholder="邮箱" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="input" placeholder="密码，至少 8 位" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <input className="input" placeholder="邀请码" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
        <Turnstile key={turnstileKey} action="register" onToken={setTurnstileToken} />
        {error ? <p style={{ color: "#9b2c1f" }}>{error}</p> : null}
        <button className="button" disabled={loading}>
          {loading ? "注册中..." : "注册"}
        </button>
        <p className="muted">
          已有账号？ <Link href="/login">登录</Link>
        </p>
      </form>
    </main>
  );
}
