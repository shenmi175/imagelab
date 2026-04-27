"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const feedbackTypes = [
  { value: "GENERAL", label: "一般反馈" },
  { value: "BUG", label: "问题反馈" },
  { value: "GENERATION_FAILED", label: "生成失败" },
  { value: "BILLING", label: "额度问题" },
  { value: "SUGGESTION", label: "功能建议" }
];

export function FeedbackButton({
  imageJobId,
  defaultType = "GENERAL",
  label = "反馈",
  compact = false
}: {
  imageJobId?: string;
  defaultType?: string;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(defaultType);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [manualJobId, setManualJobId] = useState(imageJobId ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  useEffect(() => {
    if (imageJobId) setManualJobId(imageJobId);
  }, [imageJobId]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) {
      toast.error("反馈内容不能为空");
      return;
    }

    setPending(true);
    try {
      await apiFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          contact,
          imageJobId: (imageJobId ?? manualJobId).trim() || undefined,
          pageUrl: typeof window === "undefined" ? undefined : window.location.href
        })
      });
      toast.success("反馈已提交");
      setMessage("");
      setContact("");
      if (!imageJobId) setManualJobId("");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交反馈失败");
    } finally {
      setPending(false);
    }
  }

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="feedback-modal card" role="dialog" aria-modal="true" aria-label="提交反馈" onClick={(event) => event.stopPropagation()}>
            <div className="feedback-modal-heading">
              <h2>提交反馈</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="关闭反馈">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form className="grid" onSubmit={submit}>
              <label className="form-field">
                <span>类型</span>
                <select className="select" value={type} onChange={(event) => setType(event.target.value)}>
                  {feedbackTypes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              {!imageJobId ? (
                <label className="form-field">
                  <span>任务编号</span>
                  <Input value={manualJobId} onChange={(event) => setManualJobId(event.target.value)} placeholder="可选" />
                </label>
              ) : (
                <p className="muted">任务编号：{imageJobId}</p>
              )}

              <label className="form-field">
                <span>内容</span>
                <textarea className="textarea feedback-textarea" value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} />
              </label>

              <label className="form-field">
                <span>联系方式</span>
                <Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="可选" />
              </label>

              <div className="action-row">
                <Button type="submit" disabled={pending || !message.trim()}>
                  {pending ? "提交中..." : "提交反馈"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>取消</Button>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Button type="button" variant={compact ? "ghost" : "secondary"} size={compact ? "icon" : "default"} onClick={() => setOpen(true)} aria-label="提交反馈">
        <MessageSquare className="h-4 w-4" />
        {compact ? null : label}
      </Button>
      {modal}
    </>
  );
}
