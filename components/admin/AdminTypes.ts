import type { PublicJob } from "@/components/api";

export type UserRow = {
  id: string;
  email: string;
  role: string;
  dailyQuota: number;
  isDisabled: boolean;
  createdAt: string;
  _count: { imageJobs: number };
};

export type InviteCode = {
  id: number;
  code: string;
  usedById: string | null;
  usedAt: string | null;
  createdAt: string;
};

export type AdminJob = PublicJob & {
  userEmail: string;
  userId: string;
  upstreamStatus?: number | null;
  upstreamRequestId?: string | null;
};

export type AdminStats = {
  users: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  todayJobs: number;
  completedToday: number;
  failedToday: number;
  queuedJobs: number;
  runningJobs: number;
  openFeedback: number;
  reviewingFeedback: number;
  activeWorkers: number;
  averageGenerationDurationMs: number;
  averageQueueDurationMs: number;
};
