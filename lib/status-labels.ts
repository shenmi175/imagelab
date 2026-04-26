export const terminalStatuses = new Set(["COMPLETED", "FAILED", "CANCELED", "EXPIRED"]);

export const statusLabels: Record<string, string> = {
  PENDING_ENQUEUE: "正在入队",
  QUEUED: "排队中",
  RUNNING: "正在生成",
  COMPLETED: "已完成",
  FAILED: "生成失败",
  CANCELED: "已取消",
  EXPIRED: "图片已过期"
};

export function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function friendlyErrorMessage(code?: string | null, fallback?: string | null) {
  if (!code && !fallback) return null;

  const messages: Record<string, string> = {
    NETWORK_ERROR: "图片服务暂时无法连接，请稍后重试。",
    UPSTREAM_TIMEOUT: "图片生成超时，额度已退还。",
    UPSTREAM_429: "上游图片服务繁忙或限速，请稍后再试。",
    UPSTREAM_5XX: "上游图片服务暂时不可用，请稍后再试。",
    AUTH_FAILED: "图片服务密钥无效，请联系管理员。",
    CONTENT_POLICY: "Prompt 可能违反内容规则，请修改后重试。",
    INVALID_REQUEST: "生成参数或 Prompt 被上游拒绝，请调整后再试。",
    INVALID_UPSTREAM_RESPONSE: "图片服务返回格式异常，请联系管理员。",
    QUEUE_ENQUEUE_FAILED: "任务入队失败，额度已退还，请稍后重试。",
    WORKER_STALE: "生成 Worker 中断，任务已失败或重新入队。"
  };

  return (code ? messages[code] : null) ?? fallback ?? "生成失败，请稍后重试。";
}
