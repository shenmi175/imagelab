export type JobDurationInput = {
  createdAt: Date | string;
  queuedAt?: Date | string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
};

function toTime(value?: Date | string | null) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function diffMs(start?: Date | string | null, end?: Date | string | null) {
  const startTime = toTime(start);
  const endTime = toTime(end);
  if (startTime === null || endTime === null || endTime < startTime) return null;
  return endTime - startTime;
}

export function jobDurations(job: JobDurationInput) {
  return {
    enqueueDurationMs: diffMs(job.createdAt, job.queuedAt),
    queueDurationMs: diffMs(job.createdAt, job.startedAt),
    generationDurationMs: diffMs(job.startedAt, job.completedAt),
    totalDurationMs: diffMs(job.createdAt, job.completedAt)
  };
}

export function activeDurationMs(job: JobDurationInput & { status: string }, now = Date.now()) {
  if (["PENDING_ENQUEUE", "QUEUED"].includes(job.status)) {
    const createdAt = toTime(job.createdAt);
    return createdAt === null ? 0 : Math.max(0, now - createdAt);
  }

  if (job.status === "RUNNING") {
    const startedAt = toTime(job.startedAt);
    return startedAt === null ? 0 : Math.max(0, now - startedAt);
  }

  return jobDurations(job).totalDurationMs ?? 0;
}

export function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return "-";

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const two = (value: number) => value.toString().padStart(2, "0");
  if (hours > 0) return `${two(hours)}:${two(minutes)}:${two(seconds)}`;
  return `${two(minutes)}:${two(seconds)}`;
}

export function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
