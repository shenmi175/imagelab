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

const qualityLabels: Record<string, string> = {
  low: "草稿",
  medium: "标准",
  high: "精细",
  auto: "自动"
};

export function qualityLabel(value?: string | null) {
  return value ? qualityLabels[value] ?? "未知质量" : "未知质量";
}

const outputFormatLabels: Record<string, string> = {
  png: "无损图",
  jpeg: "压缩图",
  jpg: "压缩图",
  webp: "网页图"
};

export function outputFormatLabel(value?: string | null) {
  return value ? outputFormatLabels[value] ?? "未知格式" : "未知格式";
}

export function jobModeLabel(mode?: string | null, inputImageCount?: number | null) {
  if (mode === "EDIT") return `图像编辑${inputImageCount ? `，参考图 ${inputImageCount} 张` : ""}`;
  return "文生图";
}

const errorCodeLabels: Record<string, string> = {
  NETWORK_ERROR: "网络连接失败",
  UPSTREAM_TIMEOUT: "上游超时",
  UPSTREAM_429: "上游限速",
  UPSTREAM_5XX: "上游不可用",
  AUTH_FAILED: "密钥无效",
  CONTENT_POLICY: "内容规则拦截",
  INVALID_REQUEST: "参数被拒绝",
  INVALID_UPSTREAM_RESPONSE: "上游响应异常",
  UPSTREAM_PAYLOAD_TOO_LARGE: "参考图过大",
  QUEUE_ENQUEUE_FAILED: "入队失败",
  WORKER_STALE: "工作进程中断"
};

export function errorCodeLabel(code?: string | null) {
  return code ? errorCodeLabels[code] ?? "未知错误" : "无错误";
}

const logActionLabels: Record<string, string> = {
  LOGIN: "登录",
  LOGOUT: "退出登录",
  REGISTER: "注册",
  CREATE_JOB: "创建任务",
  GENERATE: "生成图片",
  DOWNLOAD: "下载图片",
  SUBMIT_FEEDBACK: "提交反馈",
  ADMIN_UPDATE_USER: "更新用户",
  ADMIN_DELETE_JOB: "删除任务",
  ADMIN_UPDATE_FEEDBACK: "处理反馈"
};

export function logActionLabel(action?: string | null) {
  return action ? logActionLabels[action] ?? "其他操作" : "其他操作";
}

const logStatusLabels: Record<string, string> = {
  OK: "成功",
  FAILED: "失败"
};

export function logStatusLabel(value?: string | null) {
  return value ? logStatusLabels[value] ?? "未知状态" : "未知状态";
}

export function friendlyErrorMessage(code?: string | null, fallback?: string | null) {
  if (!code && !fallback) return null;

  const messages: Record<string, string> = {
    NETWORK_ERROR: "图片服务暂时无法连接，请稍后重试。",
    UPSTREAM_TIMEOUT: "图片生成超时，额度已退还。",
    UPSTREAM_429: "上游图片服务繁忙或限速，请稍后再试。",
    UPSTREAM_5XX: "上游图片服务暂时不可用，请稍后再试。",
    AUTH_FAILED: "图片服务密钥无效，请联系管理员。",
    CONTENT_POLICY: "提示词可能违反内容规则，请修改后重试。",
    INVALID_REQUEST: "生成参数或提示词被上游拒绝，请调整后再试。",
    UPSTREAM_PAYLOAD_TOO_LARGE: "参考图请求体过大，额度已退还。请减少图片数量或降低图片分辨率后重试。",
    INVALID_UPSTREAM_RESPONSE: "图片服务返回格式异常，请联系管理员。",
    QUEUE_ENQUEUE_FAILED: "任务入队失败，额度已退还，请稍后重试。",
    WORKER_STALE: "生成工作进程中断，任务已失败或重新入队。"
  };

  return (code ? messages[code] : null) ?? fallback ?? "生成失败，请稍后重试。";
}
