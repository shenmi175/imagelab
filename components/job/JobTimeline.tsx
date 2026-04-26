import type { PublicJob } from "@/components/api";
import { formatDateTime, formatDuration } from "@/lib/duration";

const steps = [
  { key: "createdAt", label: "创建" },
  { key: "queuedAt", label: "入队" },
  { key: "startedAt", label: "开始生成" },
  { key: "completedAt", label: "完成" }
] as const;

export function JobTimeline({ job }: { job: PublicJob }) {
  return (
    <div className="timeline">
      {steps.map((step) => {
        const value = job[step.key];
        return (
          <div className={value ? "timeline-step active" : "timeline-step"} key={step.key}>
            <span />
            <div>
              <strong>{step.label}</strong>
              <p className="muted">{formatDateTime(value)}</p>
            </div>
          </div>
        );
      })}
      <div className="duration-grid">
        <div>
          <span className="muted">排队耗时</span>
          <strong>{formatDuration(job.queueDurationMs)}</strong>
        </div>
        <div>
          <span className="muted">生成耗时</span>
          <strong>{formatDuration(job.generationDurationMs)}</strong>
        </div>
        <div>
          <span className="muted">总耗时</span>
          <strong>{formatDuration(job.totalDurationMs)}</strong>
        </div>
      </div>
    </div>
  );
}
