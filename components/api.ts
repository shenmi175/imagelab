"use client";

export async function csrfToken() {
  const response = await fetch("/api/auth/csrf", { credentials: "include" });
  const json = (await response.json()) as { csrfToken: string };
  return json.csrfToken;
}

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const method = init.method?.toUpperCase();
  const headers = new Headers(init.headers);
  if (method && method !== "GET" && method !== "HEAD") {
    headers.set("x-csrf-token", await csrfToken());
  }
  const response = await fetch(url, { ...init, headers, credentials: "include" });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(json.message ?? "请求失败");
  }
  return json;
}

export type PublicJob = {
  id: string;
  prompt: string;
  model: string;
  mode: string;
  inputImageCount: number;
  status: "PENDING_ENQUEUE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED" | "EXPIRED";
  statusLabel: string;
  size: string;
  quality: string;
  attempts: number;
  createdAt: string;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  enqueueDurationMs?: number | null;
  queueDurationMs?: number | null;
  generationDurationMs?: number | null;
  totalDurationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  displayError?: string | null;
  imageUrl?: string | null;
  downloadUrl?: string | null;
};

export type MeResponse = {
  user: { id: string; email: string; role: "USER" | "ADMIN"; dailyQuota: number } | null;
  remainingQuota?: number;
};
