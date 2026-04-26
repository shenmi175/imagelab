# 图片生成体验站开发文档 v0.2

目标：开发一个可部署到服务器、供少量外部用户体验的 AI 图片生成网站。用户登录后提交 prompt，后端创建任务并进入队列，独立 Worker 调用已部署的 Sub2API `gpt-image-2`，生成完成后用户在网页预览和下载图片。

本文档替代 v0.1。v0.2 的重点是补齐上线时最容易出事故的部分：额度并发原子性、DB 与 Redis 入队一致性、Worker 崩溃恢复、图片鉴权访问、限流防刷、Docker 迁移与健康检查。

---

## 1. 结论和边界

### 1.1 可行性

方案可行。核心架构必须保持：

```text
浏览器
  -> 本站 Next.js API
  -> PostgreSQL 记录任务和额度
  -> Redis/BullMQ 队列
  -> 独立 Worker
  -> 内网 Sub2API
  -> 本地私有图片目录
  -> 鉴权 API 预览/下载
```

禁止做成：

```text
浏览器 -> Sub2API
浏览器 -> 静态公开图片目录
HTTP 请求同步等待图片生成完成
```

### 1.2 MVP 必须实现

```text
邀请码注册
登录 / 退出 / 当前用户
每日额度
用户级并发限制
全站队列上限
异步图片任务
任务状态页轮询
图片预览和下载
管理员用户管理
管理员任务管理
邀请码管理
清理过期图片和 session
基础限流
Docker 部署
```

### 1.3 MVP 暂不实现

```text
支付充值
公开图库
OAuth 登录
邮箱验证
图片编辑 / 图生图
多模型商城
多语言
复杂积分系统
对象存储
```

---

## 2. OpenAI / Sub2API 接口约束

当前项目通过已部署的 Sub2API 调用 OpenAI 兼容的图片生成接口：

```http
POST {SUB2API_BASE_URL}/v1/images/generations
Authorization: Bearer {SUB2API_API_KEY}
Content-Type: application/json
```

请求体固定由服务端生成：

```json
{
  "model": "gpt-image-2",
  "prompt": "A cute orange cat astronaut on the moon.",
  "size": "1024x1024",
  "quality": "high",
  "output_format": "png"
}
```

实现要求：

```text
普通用户不能传 model
普通用户不能传 n
MVP 不主动发送 n，依赖上游默认生成一张图
如果你的 Sub2API 明确要求或确认支持 n，再由服务端固定 n=1
MVP 固定 output_format=png
MVP 不传 background=transparent，gpt-image-2 不支持透明背景
读取响应 data[0].b64_json
base64 解码后保存为 PNG 文件
记录上游 HTTP status、request id、错误体前 1000 字符
日志中禁止出现 SUB2API_API_KEY
```

尺寸策略：

```text
OpenAI 官方文档说明 gpt-image-2 支持更灵活的尺寸。
MVP 为了控成本和控 UI，只开放以下三个尺寸：
1024x1024
1536x1024
1024x1536
```

质量策略：

```text
允许 low、medium、high。
默认 high。
如果成本压力明显，可把新用户默认值改成 medium。
```

---

## 3. 技术栈

```text
框架：Next.js App Router + TypeScript
数据库：PostgreSQL 16
ORM：Prisma
队列：Redis 7 + BullMQ
密码哈希：argon2id
样式：Tailwind CSS
图片存储：服务器本地私有目录
反向代理：Nginx
部署：Docker Compose
上游：Sub2API
```

选择理由：

```text
Next.js 适合同时承载前端页面和 API。
PostgreSQL 适合做额度、任务状态、审计日志的强一致记录。
Redis/BullMQ 适合做异步任务和并发控制。
Worker 独立进程能避免图片生成阻塞 Web 请求。
本地存储足够支撑小规模体验站，后续再迁移对象存储。
```

---

## 4. 核心风险和解决方案

### 4.1 额度和并发必须原子化

问题：如果只是“先查额度，再创建任务”，用户并发提交多个请求时可能绕过每日额度和单用户 active job 限制。

解决方案：

```text
创建任务时开启 PostgreSQL transaction。
事务内先拿全局队列锁和用户锁。
在同一个事务里检查：
用户是否禁用
今日已计费任务数
用户 active job 数
全站 QUEUED/PENDING_ENQUEUE 数
然后创建 ImageJob 和 QueueOutbox。
提交失败则不创建任务。
遇到 serialization conflict 或 lock timeout，返回 409/429，让前端提示稍后重试。
```

锁策略：

```sql
-- 全局队列创建锁，避免 MAX_QUEUE_LENGTH 竞态
SELECT pg_advisory_xact_lock(10001);

-- 用户级锁，避免同一用户并发绕过额度
SELECT pg_advisory_xact_lock(20000 + $userId);
```

说明：体验站规模小，全局创建锁的性能成本可以接受，换来实现简单和结果稳定。

### 4.2 DB 和 Redis 入队必须可恢复

问题：DB 任务创建成功后，如果进程在写 Redis 队列前崩溃，会出现“数据库有任务，但队列没有任务”的孤儿任务。

解决方案：使用 Outbox 模式。

```text
创建任务事务内：
ImageJob.status = PENDING_ENQUEUE
创建 QueueOutbox(imageJobId)

事务提交后：
调用 enqueuePendingJob(imageJobId)
BullMQ jobId 固定使用 imageJobId
入队成功后把 ImageJob.status 改为 QUEUED，并删除 QueueOutbox

后台 dispatcher：
每 10 秒扫描 QueueOutbox
对未入队任务重复调用 enqueuePendingJob
由于 BullMQ jobId=imageJobId，重复入队是幂等的
```

### 4.3 Worker 崩溃后任务必须能恢复

问题：Worker 把任务设为 RUNNING 后崩溃，任务可能永久卡在 RUNNING。

解决方案：

```text
BullMQ attempts 设为 1，不依赖自动重试修改业务状态。
业务层自己维护 attempts、workerId、lockedAt、lockExpiresAt。
Worker 只领取 status=QUEUED 的任务。
领取时原子更新为 RUNNING。
Worker 正常失败时按错误类型决定 FAILED 或重新 QUEUED。
Reconciler 定时扫描过期 RUNNING 任务。
RUNNING 且 lockExpiresAt < now 且 attempts < MAX_JOB_ATTEMPTS，则改回 QUEUED 并重新入队。
RUNNING 且 attempts >= MAX_JOB_ATTEMPTS，则标记 FAILED。
```

任务领取必须用条件更新：

```sql
UPDATE "ImageJob"
SET status = 'RUNNING',
    attempts = attempts + 1,
    workerId = $workerId,
    lockedAt = now(),
    lockExpiresAt = now() + interval '15 minutes',
    startedAt = COALESCE(startedAt, now())
WHERE id = $imageJobId
  AND status = 'QUEUED'
RETURNING *;
```

如果返回 0 行，Worker 必须直接结束，不得生成图片。

### 4.4 图片不能静态公开

问题：如果把 `/generated` 直接暴露给公网，知道路径的人可以绕过权限下载别人的图片。

解决方案：

```text
图片保存到私有目录。
不配置 public static 暴露 storage。
预览走 GET /api/image-jobs/:id/image。
下载走 GET /api/image-jobs/:id/download。
两个接口都必须检查 session。
普通用户只能访问自己的任务。
管理员可以访问所有任务。
文件路径只保存在数据库，不返回绝对路径。
```

MVP 由 Next.js API stream 文件即可。后续图片量变大时，再用 Nginx `X-Accel-Redirect` 提升性能，仍然保持 private internal location。

### 4.5 公网站点必须第一版就限流

问题：邀请码一旦泄露，免费站很容易被批量注册、撞库登录或刷任务。

解决方案：

```text
注册接口按 IP 限流。
登录接口按 IP + email 限流。
创建任务按 userId + IP 限流。
任务轮询按 userId 限流。
管理员接口按 admin userId 限流。
生产环境建议第一版就接 Cloudflare Turnstile 到注册和登录页。
```

### 4.6 Docker 必须包含迁移和健康检查

问题：`depends_on` 只保证容器启动顺序，不保证 PostgreSQL/Redis 已可用，也不会自动执行 Prisma migration。

解决方案：

```text
compose 增加 migrate service。
postgres 和 redis 配置 healthcheck。
app 和 worker 依赖 migrate 成功完成。
启动前执行 prisma generate。
生产迁移使用 prisma migrate deploy，不使用 migrate dev。
```

---

## 5. 环境变量

`.env.example`：

```env
# App
NODE_ENV=production
APP_URL=https://image.example.com
TRUST_PROXY=true
SESSION_SECRET=change-to-64-random-bytes
SESSION_COOKIE_NAME=image_site_session
SESSION_TTL_DAYS=14

# Database
DATABASE_URL=postgresql://image_app:change-me@postgres:5432/image_app

# Redis / BullMQ
REDIS_URL=redis://redis:6379
QUEUE_NAME=image-generation

# Sub2API
SUB2API_BASE_URL=http://sub2api:8080
SUB2API_API_KEY=sk-change-me
IMAGE_MODEL=gpt-image-2
UPSTREAM_TIMEOUT_SECONDS=900

# Image defaults
DEFAULT_IMAGE_SIZE=1024x1024
DEFAULT_IMAGE_QUALITY=high
DEFAULT_IMAGE_FORMAT=png
MAX_PROMPT_LENGTH=2000

# Queue and worker limits
MAX_GLOBAL_CONCURRENCY=2
MAX_QUEUE_LENGTH=50
MAX_USER_ACTIVE_JOBS=1
MAX_JOB_ATTEMPTS=2
JOB_LOCK_SECONDS=900
RUNNING_JOB_STALE_SECONDS=960
OUTBOX_DISPATCH_INTERVAL_SECONDS=10
RECONCILE_INTERVAL_SECONDS=60

# User limits
DEFAULT_DAILY_QUOTA=3
ADMIN_BYPASS_DAILY_QUOTA=true

# Rate limits
RATE_LIMIT_REGISTER_IP_HOUR=3
RATE_LIMIT_LOGIN_IP_MINUTE=10
RATE_LIMIT_LOGIN_EMAIL_HOUR=20
RATE_LIMIT_CREATE_JOB_USER_MINUTE=3
RATE_LIMIT_POLL_USER_MINUTE=60

# Storage
IMAGE_STORAGE_DIR=/app/storage/generated
IMAGE_RETENTION_DAYS=3

# Admin seed
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-before-deploy

# Optional Turnstile
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

生产要求：

```text
SUB2API_API_KEY 只允许后端和 Worker 使用。
任何 NEXT_PUBLIC_* 变量都不能包含密钥。
SESSION_SECRET 至少 32 字节随机值，建议 64 字节。
ADMIN_PASSWORD 首次部署后必须修改或删除 seed 默认密码。
```

---

## 6. 数据库设计

使用 Prisma。核心 schema 如下，字段名可按实现微调，但语义不能丢。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  ADMIN
}

enum JobStatus {
  PENDING_ENQUEUE
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELED
  EXPIRED
}

enum OutboxStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}

model User {
  id           Int        @id @default(autoincrement())
  email        String     @unique
  passwordHash String
  role         UserRole   @default(USER)
  dailyQuota   Int        @default(3)
  isDisabled   Boolean    @default(false)

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  sessions     Session[]
  imageJobs    ImageJob[]
  usageLogs    UsageLog[]
}

model Session {
  id         String   @id @default(cuid())
  userId     Int
  tokenHash  String   @unique
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  lastSeenAt DateTime?

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model InviteCode {
  id         Int      @id @default(autoincrement())
  code       String   @unique
  usedById   Int?
  usedAt     DateTime?
  expiresAt  DateTime?
  createdAt  DateTime @default(now())
  createdById Int?

  @@index([usedById])
  @@index([expiresAt])
}

model ImageJob {
  id            String    @id @default(cuid())
  userId        Int

  model         String
  prompt        String
  size          String
  quality       String
  outputFormat  String

  status        JobStatus @default(PENDING_ENQUEUE)
  queueJobId    String?   @unique

  attempts      Int       @default(0)
  workerId      String?
  lockedAt      DateTime?
  lockExpiresAt DateTime?

  resultPath    String?
  resultMime    String?
  resultBytes   Int?
  resultDeletedAt DateTime?

  errorCode     String?
  errorMessage  String?
  upstreamStatus Int?
  upstreamRequestId String?

  quotaDate     String
  quotaCharged  Boolean   @default(true)
  quotaRefundedAt DateTime?

  requestIpHash String?
  userAgent     String?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  queuedAt      DateTime?
  startedAt     DateTime?
  completedAt   DateTime?

  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  usageLogs     UsageLog[]
  outbox        QueueOutbox?

  @@index([userId, createdAt])
  @@index([userId, status])
  @@index([status, createdAt])
  @@index([status, lockExpiresAt])
  @@index([quotaDate, userId])
}

model QueueOutbox {
  id          String       @id @default(cuid())
  imageJobId  String       @unique
  status      OutboxStatus @default(PENDING)
  attempts    Int          @default(0)
  lastError   String?
  nextRunAt   DateTime     @default(now())
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  imageJob    ImageJob     @relation(fields: [imageJobId], references: [id], onDelete: Cascade)

  @@index([status, nextRunAt])
}

model UsageLog {
  id          Int       @id @default(autoincrement())
  userId      Int
  imageJobId  String?
  action      String
  status      String
  detail      String?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  imageJob    ImageJob? @relation(fields: [imageJobId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt])
  @@index([imageJobId])
}
```

说明：

```text
quotaDate 使用站点业务时区日期，例如 Asia/Hong_Kong 的 YYYY-MM-DD。
quotaCharged=true 且 quotaRefundedAt=null 的任务计入每日额度。
requestIpHash 用 HMAC-SHA256(IP, SESSION_SECRET) 保存，避免明文长期存 IP。
queueJobId 固定等于 imageJob.id，确保 BullMQ 幂等入队。
```

---

## 7. 认证和会话

### 7.1 密码

```text
使用 argon2id。
密码最少 8 字符。
登录失败不返回“邮箱不存在”或“密码错误”的区别。
```

### 7.2 Session

```text
登录成功生成 32 字节随机 token。
数据库只保存 sha256(token) 或 HMAC(token)。
浏览器保存 HttpOnly cookie。
cookie 设置 Secure、HttpOnly、SameSite=Lax。
生产环境只允许 HTTPS。
退出登录时删除当前 session。
清理任务定期删除过期 session。
```

### 7.3 CSRF

因为使用 cookie 鉴权，所有会改变状态的接口都要做 CSRF 防护：

```text
GET /api/auth/csrf 返回 csrf token。
前端把 token 放到 X-CSRF-Token。
服务端校验 token 与 session 绑定。
SameSite=Lax 不能替代 CSRF token。
```

MVP 如果想减少实现量，至少对所有 POST/PATCH/DELETE 检查 `Origin` 和 `Host` 一致，但最终仍建议实现 CSRF token。

---

## 8. API 设计

统一错误格式：

```json
{
  "error": "ERROR_CODE",
  "message": "用户可读错误信息"
}
```

常见错误码：

```text
UNAUTHORIZED
FORBIDDEN
USER_DISABLED
INVALID_INPUT
CSRF_FAILED
RATE_LIMITED
DAILY_QUOTA_EXCEEDED
USER_ACTIVE_JOB_LIMIT
QUEUE_FULL
JOB_NOT_FOUND
IMAGE_NOT_READY
IMAGE_EXPIRED
GENERATION_FAILED
SUB2API_UNAVAILABLE
```

### 8.1 Auth API

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/csrf
```

注册逻辑：

```text
检查限流和 Turnstile。
检查 email 格式。
检查密码长度。
检查邀请码存在、未使用、未过期。
argon2id 哈希密码。
事务内创建用户并标记邀请码 used。
创建 session。
设置 cookie。
```

登录逻辑：

```text
检查限流和 Turnstile。
查找用户。
校验密码。
检查用户未禁用。
创建 session。
设置 cookie。
记录登录成功或失败日志。
```

### 8.2 Image Job API

#### POST `/api/image-jobs`

请求：

```json
{
  "prompt": "A detailed infographic about an endangered snow leopard...",
  "size": "1024x1024",
  "quality": "high"
}
```

校验：

```text
必须登录。
用户不能被禁用。
通过 CSRF。
通过 userId + IP 限流。
prompt trim 后非空。
prompt 长度 <= MAX_PROMPT_LENGTH。
size 只能是 1024x1024、1536x1024、1024x1536。
quality 只能是 low、medium、high。
model、outputFormat、n 由服务端强制设置。
```

创建任务事务：

```text
BEGIN
拿全局 advisory lock。
拿用户 advisory lock。
重新读取用户并检查 isDisabled。
统计今日计费任务数。
检查 dailyQuota。
统计用户 active job：PENDING_ENQUEUE、QUEUED、RUNNING。
检查 MAX_USER_ACTIVE_JOBS。
统计全站等待任务：PENDING_ENQUEUE、QUEUED。
检查 MAX_QUEUE_LENGTH。
创建 ImageJob(status=PENDING_ENQUEUE, quotaCharged=true)。
创建 QueueOutbox(imageJobId)。
COMMIT
事务提交后尝试 enqueuePendingJob(imageJobId)。
返回 job id。
```

响应：

```json
{
  "id": "clxxx",
  "status": "PENDING_ENQUEUE",
  "message": "任务已创建，正在进入队列"
}
```

如果提交后马上入队成功，可以返回：

```json
{
  "id": "clxxx",
  "status": "QUEUED",
  "message": "任务已加入队列"
}
```

#### GET `/api/image-jobs`

返回当前用户任务列表，管理员可传 `userId` 查看指定用户。

响应字段：

```json
{
  "items": [
    {
      "id": "clxxx",
      "prompt": "...",
      "model": "gpt-image-2",
      "status": "COMPLETED",
      "size": "1024x1024",
      "quality": "high",
      "createdAt": "...",
      "completedAt": "...",
      "imageUrl": "/api/image-jobs/clxxx/image",
      "downloadUrl": "/api/image-jobs/clxxx/download"
    }
  ]
}
```

#### GET `/api/image-jobs/:id`

普通用户只能读取自己的任务，管理员可以读取任意任务。

响应：

```json
{
  "id": "clxxx",
  "status": "RUNNING",
  "prompt": "...",
  "model": "gpt-image-2",
  "size": "1024x1024",
  "quality": "high",
  "attempts": 1,
  "createdAt": "...",
  "queuedAt": "...",
  "startedAt": "...",
  "completedAt": null,
  "imageUrl": null,
  "downloadUrl": null,
  "errorMessage": null
}
```

#### GET `/api/image-jobs/:id/image`

用于网页预览：

```text
必须登录。
普通用户只能访问自己的任务。
管理员可以访问任意任务。
任务必须 COMPLETED。
resultPath 必须存在且未过期。
返回 Content-Type: image/png。
返回 Content-Disposition: inline。
设置 Cache-Control: private, max-age=300。
```

#### GET `/api/image-jobs/:id/download`

用于下载：

```text
权限同 image 接口。
返回 Content-Disposition: attachment; filename="{jobId}.png"。
记录 UsageLog action=DOWNLOAD。
```

### 8.3 Admin API

```text
GET    /api/admin/users
PATCH  /api/admin/users/:id
GET    /api/admin/image-jobs
GET    /api/admin/image-jobs/:id
DELETE /api/admin/image-jobs/:id
GET    /api/admin/invite-codes
POST   /api/admin/invite-codes
DELETE /api/admin/invite-codes/:id
GET    /api/admin/stats
```

管理员操作要求：

```text
所有接口必须检查 role=ADMIN。
禁用用户后，该用户不能登录，也不能创建新任务。
禁用用户不自动取消已运行任务，管理员可单独取消。
删除任务时同时删除图片文件，并记录 UsageLog。
修改 dailyQuota 必须记录操作日志。
```

---

## 9. 队列设计

队列名称：

```text
image-generation
```

BullMQ job payload：

```ts
type ImageGenerationPayload = {
  imageJobId: string;
};
```

BullMQ job options：

```ts
{
  jobId: imageJobId,
  attempts: 1,
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86400, count: 5000 }
}
```

原因：

```text
jobId=imageJobId 让重复入队幂等。
attempts=1 避免 BullMQ 自动重试和数据库业务状态冲突。
业务重试由 ImageJob.attempts + Reconciler 控制。
```

### 9.1 enqueuePendingJob

伪代码：

```ts
async function enqueuePendingJob(imageJobId: string) {
  const job = await prisma.imageJob.findUnique({ where: { id: imageJobId } });
  if (!job) return;
  if (!["PENDING_ENQUEUE", "QUEUED"].includes(job.status)) return;

  await queue.add("generate", { imageJobId }, { jobId: imageJobId, attempts: 1 });

  await prisma.$transaction(async (tx) => {
    await tx.imageJob.updateMany({
      where: { id: imageJobId, status: "PENDING_ENQUEUE" },
      data: { status: "QUEUED", queueJobId: imageJobId, queuedAt: new Date() }
    });
    await tx.queueOutbox.deleteMany({ where: { imageJobId } });
  });
}
```

### 9.2 Outbox Dispatcher

Worker 进程启动时同时启动一个轻量 dispatcher：

```text
每 OUTBOX_DISPATCH_INTERVAL_SECONDS 扫描 QueueOutbox。
只取 status=PENDING 且 nextRunAt<=now 的记录。
每次最多取 20 条。
调用 enqueuePendingJob。
失败则 attempts+1，nextRunAt 指数退避。
超过 10 次仍失败，标记 QueueOutbox.FAILED，并把 ImageJob 标记 FAILED/QUEUE_ENQUEUE_FAILED。
```

---

## 10. Worker 设计

### 10.1 Worker 主流程

伪代码：

```ts
async function processImageJob({ imageJobId }: ImageGenerationPayload) {
  const workerId = `${hostname()}-${process.pid}-${randomUUID()}`;

  const job = await claimJob(imageJobId, workerId);
  if (!job) return;

  try {
    const response = await fetch(`${SUB2API_BASE_URL}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUB2API_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: job.model,
        prompt: job.prompt,
        size: job.size,
        quality: job.quality,
        output_format: job.outputFormat
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_SECONDS * 1000)
    });

    const text = await response.text();
    const upstreamRequestId = response.headers.get("x-request-id");

    if (!response.ok) {
      throw classifyUpstreamError(response.status, text, upstreamRequestId);
    }

    const json = JSON.parse(text);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new GenerationError("INVALID_UPSTREAM_RESPONSE", "Missing data[0].b64_json");

    const buffer = Buffer.from(b64, "base64");
    assertPng(buffer);

    const filePath = await saveImageFile(job.id, buffer, job.outputFormat);

    await prisma.imageJob.updateMany({
      where: { id: job.id, workerId, status: "RUNNING" },
      data: {
        status: "COMPLETED",
        resultPath: filePath,
        resultMime: "image/png",
        resultBytes: buffer.length,
        upstreamRequestId,
        completedAt: new Date(),
        lockExpiresAt: null
      }
    });

    await logUsage(job.userId, job.id, "GENERATE", "COMPLETED");
  } catch (err) {
    await handleJobFailure(job, workerId, err);
  }
}
```

### 10.2 错误分类

可重试错误：

```text
SUB2API_UNAVAILABLE
UPSTREAM_TIMEOUT
UPSTREAM_429
UPSTREAM_5XX
NETWORK_ERROR
```

不可重试错误：

```text
INVALID_PROMPT
INVALID_REQUEST
CONTENT_POLICY
UNSUPPORTED_SIZE
AUTH_FAILED
INVALID_UPSTREAM_RESPONSE
```

处理规则：

```text
可重试且 attempts < MAX_JOB_ATTEMPTS：
  status 改回 QUEUED。
  通过 BullMQ delay 重新入队。

可重试但 attempts >= MAX_JOB_ATTEMPTS：
  status=FAILED。
  errorCode 记录具体原因。
  如果是 SUB2API_UNAVAILABLE/UPSTREAM_5XX/UPSTREAM_TIMEOUT，可退还额度。

不可重试：
  status=FAILED。
  不退还额度，避免恶意刷失败请求。
```

### 10.3 Reconciler

Worker 进程启动时启动 reconciler：

```text
每 RECONCILE_INTERVAL_SECONDS 扫描：
PENDING_ENQUEUE 但没有 outbox 的任务：补 QueueOutbox。
QUEUED 但 BullMQ 不存在对应 job 的任务：重新入队。
RUNNING 且 lockExpiresAt < now 的任务：按 attempts 决定重新 QUEUED 或 FAILED。
COMPLETED 但 resultPath 文件不存在：标记 IMAGE_FILE_MISSING。
```

这一步是生产稳定性的关键，不应省略。

---

## 11. 图片存储

保存路径：

```text
/app/storage/generated/YYYY-MM-DD/{imageJobId}.png
```

保存要求：

```text
按日期创建目录。
文件名只使用 imageJobId。
禁止使用用户 prompt 作为文件名。
写入前确保目录存在。
写入使用临时文件再 rename，避免半文件。
数据库保存绝对路径或相对 storage key 均可，但 API 不返回该路径。
读取文件时必须确认路径在 IMAGE_STORAGE_DIR 下。
```

保存伪代码：

```ts
async function saveImageFile(jobId: string, buffer: Buffer, format: "png") {
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.join(IMAGE_STORAGE_DIR, date);
  await fs.mkdir(dir, { recursive: true });

  const finalPath = path.join(dir, `${jobId}.${format}`);
  const tmpPath = `${finalPath}.${process.pid}.tmp`;

  await fs.writeFile(tmpPath, buffer, { flag: "wx" });
  await fs.rename(tmpPath, finalPath);
  return finalPath;
}
```

PNG 校验：

```text
检查文件头是否为 PNG magic bytes。
限制最大文件大小，例如 50MB。
```

---

## 12. 限额和计费规则

默认：

```text
普通用户每日 3 张。
管理员不受每日额度限制，但仍受系统并发保护。
每个普通用户同时最多 1 个 active job。
全站最多 50 个等待任务。
Worker 默认并发 2，稳定后再调到 3。
```

active job：

```text
PENDING_ENQUEUE
QUEUED
RUNNING
```

每日额度统计：

```text
quotaDate = 站点业务时区 YYYY-MM-DD。
计入额度的任务：quotaCharged=true 且 quotaRefundedAt=null。
创建任务时即占用额度。
任务取消是否退还：MVP 不退。
用户 prompt 或参数错误导致失败：不退。
Sub2API 不可用、上游 5xx、网络超时：可退。
```

退还额度只需要更新任务：

```text
quotaRefundedAt = now()
errorCode = SUB2API_UNAVAILABLE / UPSTREAM_TIMEOUT / UPSTREAM_5XX
```

因为额度通过 ImageJob 统计，不需要额外维护计数器，避免计数漂移。

---

## 13. 前端页面

### 13.1 `/login`

```text
邮箱
密码
Turnstile
登录按钮
注册链接
```

### 13.2 `/register`

```text
邮箱
密码
邀请码
Turnstile
注册按钮
```

### 13.3 `/dashboard`

```text
今日剩余额度
当前 active job
最近任务列表
生成图片入口
失败任务提示
```

### 13.4 `/generate`

```text
Prompt 输入框
尺寸选择：1024x1024、1536x1024、1024x1536
质量选择：low、medium、high
内容规则提示
提交按钮
```

提交成功后跳转：

```text
/jobs/:id
```

### 13.5 `/jobs/:id`

```text
任务状态
prompt
尺寸和质量
排队中 / 生成中 UI
失败原因
完成后的图片预览
下载按钮
```

轮询策略：

```text
PENDING_ENQUEUE / QUEUED / RUNNING：每 3 秒轮询。
页面不可见时暂停或降频到 15 秒。
COMPLETED / FAILED / CANCELED / EXPIRED：停止轮询。
连续 5 次网络错误后降频并提示刷新。
```

### 13.6 `/admin`

```text
用户列表
禁用 / 启用用户
修改每日额度
任务列表
失败任务详情
生成邀请码
删除任务和图片文件
基础统计：今日任务数、失败数、队列长度
```

---

## 14. 安全和滥用控制

第一版必须有：

```text
邀请码注册。
注册、登录、创建任务限流。
HttpOnly Secure session cookie。
CSRF 防护。
prompt 长度限制。
用户每日额度。
用户 active job 限制。
全站队列上限。
记录 prompt。
记录 IP hash 和 user agent。
管理员禁用用户。
日志脱敏。
```

生产建议第一版就接：

```text
Cloudflare Turnstile。
Cloudflare WAF 基础规则。
Nginx 请求体大小限制。
Nginx / Cloudflare 真实 IP 配置。
```

用户提交前显示规则：

```text
请勿生成违法、色情、仇恨、暴力、侵犯他人隐私、侵犯版权或冒充他人的内容。违规账号会被禁用。
```

---

## 15. 日志和审计

必须记录：

```text
用户注册
登录成功
登录失败
创建图片任务
入队成功 / 入队失败
任务开始执行
Sub2API 请求失败
任务生成成功
任务生成失败
图片预览
图片下载
管理员修改用户
管理员禁用用户
管理员删除任务
```

禁止记录：

```text
用户明文密码
SUB2API_API_KEY
完整 session token
完整 Turnstile secret
完整上游错误体中的敏感字段
```

建议：

```text
日志使用结构化 JSON。
每个请求生成 requestId。
Worker 日志包含 imageJobId 和 upstreamRequestId。
```

---

## 16. Docker 部署

目录结构：

```text
image-site/
  app/
  components/
  lib/
  prisma/
  worker/
  scripts/
  storage/
  docker-compose.yml
  Dockerfile
  .env
  .env.example
  README.md
```

### 16.1 docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: image-site-postgres
    environment:
      POSTGRES_USER: image_app
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: image_app
    volumes:
      - image_site_postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U image_app -d image_app"]
      interval: 5s
      timeout: 5s
      retries: 20
    networks:
      - image-site

  redis:
    image: redis:7-alpine
    container_name: image-site-redis
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - image_site_redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 20
    networks:
      - image-site

  migrate:
    build: .
    container_name: image-site-migrate
    command: sh -c "npx prisma migrate deploy && npm run seed"
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - image-site

  app:
    build: .
    container_name: image-site-app
    command: npm run start
    env_file:
      - .env
    ports:
      - "3005:3000"
    volumes:
      - ./storage:/app/storage
    depends_on:
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - image-site
      - sub2api-network

  worker:
    build: .
    container_name: image-site-worker
    command: npm run worker
    env_file:
      - .env
    volumes:
      - ./storage:/app/storage
    depends_on:
      migrate:
        condition: service_completed_successfully
    networks:
      - image-site
      - sub2api-network

volumes:
  image_site_postgres:
  image_site_redis:

networks:
  image-site:
  sub2api-network:
    external: true
    name: sub2api-deploy_sub2api-network
```

`.env` 中：

```env
SUB2API_BASE_URL=http://sub2api:8080
```

如果 Sub2API 不在同一个 Docker network：

```text
Linux 宿主机可使用 host-gateway。
或让 Worker 直接访问宿主机内网 IP。
不要让 Worker 走 Cloudflare 公网域名。
```

### 16.2 npm scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker": "tsx worker/image-worker.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy",
    "prisma:dev": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts",
    "cleanup": "tsx scripts/cleanup.ts",
    "reconcile": "tsx scripts/reconcile.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## 17. Nginx

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name image.example.com;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name image.example.com;

    ssl_certificate /etc/letsencrypt/live/image.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/image.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60;
        proxy_send_timeout 60;
    }
}
```

说明：

```text
用户请求不会等待图片生成完成，因此可走 Cloudflare 橙云。
Worker 调用 Sub2API 必须走服务器内网，不走 Cloudflare。
不要配置 /storage 或 /generated 静态公开目录。
```

如果后续使用 `X-Accel-Redirect`：

```nginx
location /internal-generated/ {
    internal;
    alias /path/to/image-site/storage/generated/;
}
```

只有鉴权 API 可以返回 `X-Accel-Redirect`，外部不能直接访问该路径。

---

## 18. 清理任务

`npm run cleanup` 必须做：

```text
删除过期 session。
扫描超过 IMAGE_RETENTION_DAYS 的 COMPLETED 图片文件。
删除文件后设置 resultDeletedAt=now。
将任务状态改为 EXPIRED，或保留 COMPLETED 但 image/download 返回 IMAGE_EXPIRED。
清理过旧的 BullMQ completed/failed 记录。
```

建议：

```text
先实现手动脚本。
部署稳定后用 cron 每天凌晨执行。
清理前输出 dry-run 统计。
```

---

## 19. 初始化管理员

`prisma/seed.ts`：

```text
读取 ADMIN_EMAIL 和 ADMIN_PASSWORD。
如果 ADMIN_EMAIL 不存在，创建 ADMIN。
如果已存在，不覆盖密码。
检查当前未使用、未过期的邀请码数量。
如果少于 5 个，则补足到 5 个。
seed 日志不得输出明文密码。
```

上线要求：

```text
首次登录后立即修改管理员密码，或实现管理员改密接口。
生产环境不要长期保留弱 ADMIN_PASSWORD。
```

---

## 20. 健康检查

### 20.1 `/api/health`

返回：

```json
{
  "ok": true,
  "version": "0.2.0",
  "database": "ok",
  "redis": "ok"
}
```

要求：

```text
不返回环境变量。
不返回 Sub2API key。
可以不检查 Sub2API，避免健康检查触发上游压力。
```

### 20.2 Worker heartbeat

Worker 每 30 秒写 Redis：

```text
image-site:worker:{workerId}:heartbeat = timestamp
TTL = 90 秒
```

管理员统计页可以显示活跃 Worker 数。

---

## 21. 测试计划

### 21.1 单元测试

```text
email/password 校验。
CSRF 校验。
尺寸和质量白名单。
safe path 校验。
错误分类。
quotaDate 时区计算。
```

### 21.2 集成测试

```text
邀请码注册成功。
邀请码重复使用失败。
登录成功和失败。
禁用用户无法登录。
未登录不能创建任务。
超每日额度失败。
单用户 active job 限制生效。
全站队列满失败。
DB 创建成功但 Redis 入队失败后，outbox 能恢复。
Worker 成功生成并保存图片。
Worker 收到上游 5xx 后可重试并退还额度。
Worker 崩溃模拟后，reconciler 能恢复 RUNNING 任务。
普通用户不能访问他人图片。
管理员可以访问任意图片。
过期图片返回 IMAGE_EXPIRED。
```

### 21.3 手工验收

```text
curl 从 worker 容器内能访问 http://sub2api:8080/v1/images/generations。
提交任务后页面立即拿到 job id。
任务不会让 HTTP 请求等待图片完成。
任务完成后可预览。
下载文件是有效 PNG。
Cloudflare 橙云打开时仍可完成任务。
重启 worker 后未完成任务能恢复。
```

---

## 22. 开发顺序

### 阶段 1：项目骨架

```text
初始化 Next.js + TypeScript。
安装 Prisma、BullMQ、Redis client、argon2、Tailwind、tsx、测试工具。
配置 ESLint/TypeScript。
编写 Dockerfile 和 compose 基础版本。
```

### 阶段 2：数据库和认证

```text
编写 Prisma schema。
创建 migration。
实现 seed 管理员和邀请码。
实现 session、CSRF、auth API。
实现基础限流。
```

### 阶段 3：任务创建和 Outbox

```text
实现 ImageJob API。
实现创建任务事务和 advisory lock。
实现额度检查。
实现 active job 检查。
实现 QueueOutbox。
实现 enqueuePendingJob 和 dispatcher。
```

### 阶段 4：Worker 和存储

```text
实现 Worker。
实现 claimJob 条件更新。
实现 Sub2API 调用。
实现图片保存。
实现错误分类和重试。
实现 reconciler。
实现 cleanup。
```

### 阶段 5：前端页面

```text
登录页。
注册页。
dashboard。
generate。
job detail。
admin。
```

### 阶段 6：部署和验证

```text
完善 docker-compose healthcheck 和 migrate service。
完善 Nginx 配置。
编写 README 部署说明。
写集成测试。
在服务器上用真实 Sub2API 生成一张图。
模拟 worker 重启和入队失败。
```

---

## 23. 第一版默认配置

```text
默认模型：gpt-image-2
默认尺寸：1024x1024
默认质量：high
默认格式：png
普通用户每日额度：3
普通用户 active job：1
全站等待任务上限：50
Worker 并发：2
最大尝试次数：2
上游超时：900 秒
图片保留时间：3 天
注册方式：邀请码 + Turnstile
```

---

## 24. 验收标准

必须全部满足：

```text
Sub2API key 不出现在前端 bundle、HTML、API 响应和日志中。
未登录用户不能创建任务、查看任务、预览图片、下载图片。
普通用户不能访问其他用户任务和图片。
管理员可以查看用户和任务。
任务创建接口在并发请求下不会突破每日额度。
任务创建接口在并发请求下不会突破单用户 active job 限制。
DB 任务创建后即使 Redis 入队失败，也能通过 outbox 恢复。
Worker 崩溃后 RUNNING 任务能通过 reconciler 恢复或失败收敛。
图片文件不通过静态目录公开。
Cloudflare 代理下不会因图片生成长耗时导致用户请求超时。
Docker 首次部署会自动执行 migration 和 seed。
PostgreSQL、Redis、App 有健康检查。
cleanup 能删除过期图片和 session。
```

---

## 25. 参考资料

```text
OpenAI gpt-image-2 模型页：
https://developers.openai.com/api/docs/models/gpt-image-2

OpenAI Image generation guide：
https://developers.openai.com/api/docs/guides/image-generation

OpenAI Images API reference：
https://developers.openai.com/api/reference/resources/images

BullMQ Worker concurrency：
https://docs.bullmq.io/guide/workers/concurrency

Next.js Route Handlers：
https://nextjs.org/docs/app/getting-started/route-handlers
```
