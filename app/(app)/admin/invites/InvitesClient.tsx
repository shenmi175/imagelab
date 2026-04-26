"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/components/api";
import { AdminTabs } from "@/components/admin/AdminTabs";
import type { InviteCode } from "@/components/admin/AdminTypes";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/duration";

export default function InvitesClient() {
  const [items, setItems] = useState<InviteCode[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const data = await apiFetch<{ items: InviteCode[] }>("/api/admin/invite-codes");
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }

  async function createCodes(count = 1) {
    setCreating(true);
    try {
      await apiFetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function deleteCode(code: InviteCode) {
    if (code.usedAt) return;
    if (!confirm(`确定删除邀请码 ${code.code}？`)) return;
    await apiFetch(`/api/admin/invite-codes/${code.id}`, { method: "DELETE" });
    await load();
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="page-stack">
      <section className="workspace-hero card">
        <div>
          <p className="muted">Invite codes</p>
          <h1>邀请码管理</h1>
          <p className="muted">单独管理注册邀请码，未使用的邀请码可以复制或删除。</p>
        </div>
        <div className="action-row">
          <Button variant="secondary" onClick={() => createCodes(5)} disabled={creating}>
            <Plus className="h-4 w-4" />
            批量 5 个
          </Button>
          <Button onClick={() => createCodes(1)} disabled={creating}>
            <Plus className="h-4 w-4" />
            新建邀请码
          </Button>
        </div>
      </section>

      <AdminTabs />

      <section className="card panel-section">
        <div className="section-heading">
          <div>
            <p className="muted">Codes</p>
            <h2>邀请码列表</h2>
          </div>
          <span className="muted">最多显示最近 100 个</span>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="table-list">
          {items.map((item) => (
            <div className="table-row" key={item.id}>
              <div>
                <strong>{item.code}</strong>
                <p className="muted">
                  {item.usedAt ? `已使用 / ${formatDateTime(item.usedAt)}` : "未使用"} / 创建 {formatDateTime(item.createdAt)}
                </p>
              </div>
              <div className="action-row">
                <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(item.code)} aria-label="复制邀请码">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="destructive" onClick={() => deleteCode(item)} disabled={Boolean(item.usedAt)}>
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 ? <p className="muted">暂无邀请码。</p> : null}
        </div>
      </section>
    </main>
  );
}
