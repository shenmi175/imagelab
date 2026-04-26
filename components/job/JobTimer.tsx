"use client";

import { useEffect, useState } from "react";
import type { PublicJob } from "@/components/api";
import { activeDurationMs, formatDuration } from "@/lib/duration";
import { terminalStatuses } from "@/lib/status-labels";

function timerLabel(status: PublicJob["status"]) {
  if (status === "PENDING_ENQUEUE" || status === "QUEUED") return "已等待";
  if (status === "RUNNING") return "正在生成";
  if (status === "COMPLETED") return "总耗时";
  if (status === "FAILED") return "失败前耗时";
  return "耗时";
}

export function JobTimer({ job, compact = false }: { job: PublicJob; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const isTerminal = terminalStatuses.has(job.status);

  useEffect(() => {
    if (isTerminal) return;

    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, document.visibilityState === "visible" ? 1000 : 5000);
    return () => window.clearInterval(interval);
  }, [isTerminal, job.id, job.status]);

  const value =
    job.status === "COMPLETED"
      ? job.totalDurationMs
      : job.status === "FAILED"
        ? job.totalDurationMs
        : activeDurationMs(job, now);

  if (compact) {
    return <span>{formatDuration(value)}</span>;
  }

  return (
    <div className="timer-card">
      <span className="muted">{timerLabel(job.status)}</span>
      <strong>{formatDuration(value)}</strong>
    </div>
  );
}
