import { Badge } from "@/components/ui/badge";
import type { PublicJob } from "@/components/api";

const variants: Record<PublicJob["status"], "default" | "secondary" | "outline" | "success" | "warning" | "destructive"> = {
  PENDING_ENQUEUE: "warning",
  QUEUED: "warning",
  RUNNING: "default",
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELED: "secondary",
  EXPIRED: "outline"
};

export function JobStatusBadge({ job }: { job: Pick<PublicJob, "status" | "statusLabel"> }) {
  return <Badge variant={variants[job.status]}>{job.statusLabel}</Badge>;
}
