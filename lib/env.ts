function numberEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (!value) return fallback;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.APP_URL ?? "http://localhost:3005",
  trustProxy: boolEnv("TRUST_PROXY", true),
  sessionSecret: process.env.SESSION_SECRET ?? "8f52a3d64d3e4e5fb9c3e2519f04fe8e6ef1a2ab69b2cc1e76f2c95b6150d183",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "image_site_session",
  sessionTtlDays: numberEnv("SESSION_TTL_DAYS", 14),
  businessTimeZone: process.env.BUSINESS_TIME_ZONE ?? "Asia/Hong_Kong",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  queueName: process.env.QUEUE_NAME ?? "image-generation",
  queueBoardPort: numberEnv("QUEUE_BOARD_PORT", 3001),
  queueBoardBasePath: process.env.QUEUE_BOARD_BASE_PATH ?? "/admin/queues",
  queueBoardUsername: process.env.QUEUE_BOARD_USERNAME ?? "admin",
  queueBoardPassword: process.env.QUEUE_BOARD_PASSWORD ?? "",
  queueBoardPublicUrl: process.env.QUEUE_BOARD_PUBLIC_URL ?? "http://localhost:3006/admin/queues",
  sub2apiBaseUrl: process.env.SUB2API_BASE_URL ?? "http://127.0.0.1:8080",
  sub2apiApiKey: process.env.SUB2API_API_KEY ?? "",
  imageModel: process.env.IMAGE_MODEL ?? "gpt-image-2",
  upstreamTimeoutSeconds: numberEnv("UPSTREAM_TIMEOUT_SECONDS", 900),
  defaultImageSize: process.env.DEFAULT_IMAGE_SIZE ?? "1024x1024",
  defaultImageQuality: process.env.DEFAULT_IMAGE_QUALITY ?? "high",
  defaultImageFormat: process.env.DEFAULT_IMAGE_FORMAT ?? "png",
  defaultImageBackground: process.env.DEFAULT_IMAGE_BACKGROUND ?? "auto",
  defaultImageModeration: process.env.DEFAULT_IMAGE_MODERATION ?? "auto",
  maxPromptLength: numberEnv("MAX_PROMPT_LENGTH", 2000),
  maxGlobalConcurrency: numberEnv("MAX_GLOBAL_CONCURRENCY", 2),
  maxQueueLength: numberEnv("MAX_QUEUE_LENGTH", 50),
  maxUserActiveJobs: numberEnv("MAX_USER_ACTIVE_JOBS", 1),
  maxJobAttempts: numberEnv("MAX_JOB_ATTEMPTS", 2),
  jobLockSeconds: numberEnv("JOB_LOCK_SECONDS", 900),
  runningJobStaleSeconds: numberEnv("RUNNING_JOB_STALE_SECONDS", 180),
  workerOrphanedRunningGraceSeconds: numberEnv("WORKER_ORPHANED_RUNNING_GRACE_SECONDS", 120),
  workerHeartbeatTtlSeconds: numberEnv("WORKER_HEARTBEAT_TTL_SECONDS", 90),
  workerHeartbeatIntervalSeconds: numberEnv("WORKER_HEARTBEAT_INTERVAL_SECONDS", 30),
  outboxDispatchIntervalSeconds: numberEnv("OUTBOX_DISPATCH_INTERVAL_SECONDS", 10),
  reconcileIntervalSeconds: numberEnv("RECONCILE_INTERVAL_SECONDS", 30),
  defaultDailyQuota: numberEnv("DEFAULT_DAILY_QUOTA", 3),
  adminBypassDailyQuota: boolEnv("ADMIN_BYPASS_DAILY_QUOTA", true),
  registerIpHourLimit: numberEnv("RATE_LIMIT_REGISTER_IP_HOUR", 3),
  loginIpMinuteLimit: numberEnv("RATE_LIMIT_LOGIN_IP_MINUTE", 10),
  loginEmailHourLimit: numberEnv("RATE_LIMIT_LOGIN_EMAIL_HOUR", 20),
  createJobUserMinuteLimit: numberEnv("RATE_LIMIT_CREATE_JOB_USER_MINUTE", 3),
  feedbackUserHourLimit: numberEnv("RATE_LIMIT_FEEDBACK_USER_HOUR", 10),
  pollUserMinuteLimit: numberEnv("RATE_LIMIT_POLL_USER_MINUTE", 60),
  imageStorageDir: process.env.IMAGE_STORAGE_DIR ?? "./storage/generated",
  imageRetentionDays: numberEnv("IMAGE_RETENTION_DAYS", 3),
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY ?? "",
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? ""
} as const;

export const allowedSizes = new Set(["1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840", "auto"]);
export const allowedQualities = new Set(["low", "medium", "high", "auto"]);
export const allowedOutputFormats = new Set(["png", "jpeg"]);
export const allowedBackgrounds = new Set(["auto", "opaque"]);
export const allowedModerations = new Set(["auto", "low"]);
