# ImageLab 图像实验室

ImageLab 是一个面向生产环境的图像生成工作台，围绕用户认证、邀请码注册、任务队列、私有图片存储和独立运维控制台构建。项目通过 Sub2API 兼容接口调用图像模型，将密钥、任务状态、用户额度、图片文件和运维能力全部收敛在服务端，适合小团队、私有社区或内部工具场景使用。

项目目标不是简单封装一次 API 请求，而是提供一个可持续运营的图像生成平台：用户可以稳定提交任务、查看历史和下载结果；管理员可以管理用户、额度、邀请码、任务、反馈、日志和生成图片；系统可以在 Docker 重启、Worker 重启、上游波动等场景下尽可能恢复任务并保护用户体验。

## 核心能力

- 图像生成工作台：提示词输入、参数选择、参考图上传、任务状态、历史图库和图片下载。
- 图像编辑流程：支持多张参考图，默认上传原图；当上游请求体过大时自动压缩参考图并在同一任务内重试。
- 独立运维控制台：管理员账号登录后直接进入控制台，和普通用户工作台分离。
- 用户与额度管理：支持用户启用/禁用、自定义额度、失败任务自动退还额度。
- 邀请码体系：控制注册入口，并支持查看邀请码使用状态。
- 任务运维：查看任务状态、耗时、上游错误、请求编号、用户图片和下载入口。
- 监控面板：展示用户数、任务数、完成数、失败数、队列状态、Worker 状态和平均耗时。
- 反馈系统：用户可提交反馈，管理员可在控制台处理并关联任务。
- 私有图片存储：生成图、缩略图和上传参考图不直接暴露在静态目录下，预览和下载均走鉴权 API。
- 队列与恢复：基于 BullMQ、Redis 和 PostgreSQL，支持 outbox 恢复、Worker 心跳和 stale job 重入队。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- Prisma、PostgreSQL
- BullMQ、Redis
- Better Auth 与 Prisma Adapter
- Sharp 图片校验、缩略图生成和压缩重试
- Docker Compose 多服务部署
- Bull Board 队列看板

## 系统架构

```text
Browser
  |
  | HTTPS
  v
Next.js App
  |-- 用户工作台
  |-- 运维控制台
  |-- 登录、注册、CSRF、限流
  |-- 私有图片预览与下载 API
  |
  | PostgreSQL
  |-- users / sessions / imageJobs / usageLogs / inviteCodes / feedback
  |
  | Redis + BullMQ
  v
Image Worker
  |
  | Sub2API-compatible endpoint
  v
Image Provider
```

任务会先写入 PostgreSQL，再进入 Redis 队列。系统通过 `QueueOutbox`、Worker 心跳和定时 reconciliation 降低 Docker 重启、Redis 短暂失败、Worker 异常退出导致任务丢失或卡死的概率。

## 目录结构

```text
app/                  Next.js 页面、布局和 API 路由
components/           用户工作台、运维控制台和通用 UI 组件
lib/                  认证、鉴权、队列、存储、额度、校验和工具函数
worker/               图像生成 Worker
scripts/              队列看板、清理、任务恢复脚本
prisma/               Prisma schema、迁移和初始化脚本
storage/              本地图片存储目录，部署时挂载到容器
docker-compose.yml    应用、Worker、队列看板、PostgreSQL、Redis 编排
start.sh              部署辅助脚本
```

## 快速启动

```bash
chmod +x start.sh
./start.sh
```

首次启动时，`start.sh` 会自动创建 `.env`，生成 `SESSION_SECRET`，并在终端输出初始管理员密码和 Bull Board 密码。正式使用前请修改 `.env` 中的关键配置：

```env
APP_URL=https://your-domain.example.com
SUB2API_BASE_URL=https://your-sub2api-domain.example.com
SUB2API_API_KEY=your-sub2api-key

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=use-a-strong-password

QUEUE_BOARD_USERNAME=admin
QUEUE_BOARD_PASSWORD=use-a-strong-password
QUEUE_BOARD_PUBLIC_URL=https://your-domain.example.com/admin/queues
```

常用部署命令：

```bash
# 仅重启 Web 应用，适合 UI、页面、API 和控制台改动
./start.sh app

# 仅重启 Worker，适合队列、生成、重试和存储链路改动
./start.sh worker

# 重建并启动完整服务栈
./start.sh all
```

默认本地访问地址：

```text
Web 应用：   http://localhost:3005
运维控制台： http://localhost:3005/admin
队列看板：   http://localhost:3006/admin/queues
```

## 生产部署要点

`APP_URL` 必须设置为用户实际访问的 HTTPS 域名。该值会影响 Better Auth 的可信来源和 Cookie 策略：

```env
APP_URL=https://imagelab.example.com
```

如果应用部署在 nginx 或其他反向代理后面，请确保转发标准头：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

对于参考图上传和 Sub2API 大请求体转发，需要在 ImageLab 域名和 Sub2API 域名的 HTTPS server block 中设置请求体限制和超时：

```nginx
client_max_body_size 200m;
client_body_timeout 900s;
proxy_read_timeout 900s;
proxy_send_timeout 900s;
```

如果 Sub2API 与 ImageLab 部署在同一台服务器，建议只绑定本机地址，然后通过 nginx 暴露 HTTPS：

```text
127.0.0.1:8080:8080
```

## 环境变量

基础配置：

| 变量 | 说明 |
| --- | --- |
| `APP_URL` | 应用公开访问地址，生产环境必须使用真实 HTTPS 域名。 |
| `SESSION_SECRET` | 会话签名密钥，应使用高强度随机值。 |
| `DATABASE_URL` | PostgreSQL 连接字符串。 |
| `REDIS_URL` | Redis 连接字符串。 |
| `BUSINESS_TIME_ZONE` | 每日额度统计使用的业务时区。 |

图像生成配置：

| 变量 | 说明 |
| --- | --- |
| `SUB2API_BASE_URL` | Sub2API 兼容接口地址。 |
| `SUB2API_API_KEY` | 服务端 API Key，不会返回给前端。 |
| `IMAGE_MODEL` | 图像模型名称，例如 `gpt-image-2`。 |
| `UPSTREAM_TIMEOUT_SECONDS` | 上游生成请求超时时间。 |
| `DEFAULT_IMAGE_SIZE` | 默认图片尺寸。 |
| `DEFAULT_IMAGE_QUALITY` | 默认生成质量。 |
| `DEFAULT_IMAGE_FORMAT` | 默认输出格式。 |
| `DEFAULT_IMAGE_BACKGROUND` | 默认背景模式。 |
| `DEFAULT_IMAGE_MODERATION` | 默认审核强度。 |

参考图压缩重试配置：

| 变量 | 说明 |
| --- | --- |
| `UPSTREAM_INPUT_IMAGE_MAX_BYTES` | 压缩重试时单张参考图目标体积。 |
| `UPSTREAM_INPUT_IMAGES_TOTAL_MAX_BYTES` | 压缩重试时多图总目标体积。 |
| `UPSTREAM_INPUT_IMAGE_MAX_EDGE` | 压缩重试时图片最长边限制。 |
| `UPSTREAM_INPUT_IMAGE_QUALITY` | 压缩重试时 JPEG 质量。 |

队列与任务配置：

| 变量 | 说明 |
| --- | --- |
| `MAX_GLOBAL_CONCURRENCY` | Worker 并发数。 |
| `MAX_QUEUE_LENGTH` | 最大排队任务数。 |
| `MAX_USER_ACTIVE_JOBS` | 普通用户最大活跃任务数。 |
| `MAX_JOB_ATTEMPTS` | 可重试失败的最大尝试次数。 |
| `WORKER_STOP_GRACE_PERIOD` | Worker 容器停止宽限时间。 |
| `RUNNING_JOB_STALE_SECONDS` | 运行中任务判定为 stale 的时间。 |
| `RECONCILE_INTERVAL_SECONDS` | Worker 恢复扫描间隔。 |

账号与安全配置：

| 变量 | 说明 |
| --- | --- |
| `ADMIN_EMAIL` | 初始化管理员邮箱。 |
| `ADMIN_PASSWORD` | 初始化管理员密码。 |
| `ADMIN_RESET_PASSWORD` | 临时设为 `true` 可重置管理员密码。 |
| `DEFAULT_DAILY_QUOTA` | 新用户默认每日额度。 |
| `ADMIN_BYPASS_DAILY_QUOTA` | 管理员是否跳过每日额度限制。 |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile Site Key，可选。 |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile Secret Key，可选。 |

完整配置请参考 `.env.example`。

## 本地开发

安装依赖：

```bash
npm install
```

启动数据库和 Redis：

```bash
docker compose up -d postgres redis
```

执行迁移和初始化：

```bash
npm run prisma:dev
npm run seed
```

启动 Next.js 开发服务：

```bash
npm run dev
```

另开终端启动 Worker：

```bash
npm run worker
```

## 运维命令

```bash
npm run typecheck
npm run build

docker compose ps
docker compose logs -f app worker

docker compose exec app npm run cleanup
docker compose exec app npm run reconcile
```

重置初始化管理员密码：

```bash
# 1. 修改 .env 中的 ADMIN_PASSWORD
# 2. 临时设置：
ADMIN_RESET_PASSWORD=true

docker compose run --rm migrate

# 3. 重置完成后将 ADMIN_RESET_PASSWORD 改回 false
```

部署建议：

- UI、页面、控制台、API 变更：使用 `./start.sh app`。
- Worker、队列、图片生成、重试策略变更：使用 `./start.sh worker`。
- 基础镜像、依赖、数据库、Redis 或整体拓扑变更：使用 `./start.sh all`。
- Worker 配置了较长的停止宽限时间，用于尽量让正在生成的任务完成后再退出。

## 安全设计

- Sub2API Key 仅存在于服务端和 Worker 环境变量中。
- 图片不放入公开静态目录，预览和下载都经过鉴权 API。
- 普通用户只能访问自己的任务和图片，管理员可在控制台查看和下载用户图片。
- 修改类请求启用 CSRF 校验。
- 登录、注册、创建任务、反馈和轮询接口均有限流保护。
- 注册入口由邀请码控制。
- 管理后台独立于用户工作台，并要求管理员角色。
- Bull Board 独立运行，并使用 Basic Auth 保护。

## 任务恢复与额度策略

ImageLab 对常见中断场景做了多层防护：

- 创建任务时先写入数据库，再通过 outbox 入队。
- Redis 入队失败后，outbox 会继续尝试恢复。
- Worker 定期写入心跳，用于识别仍然活跃的工作进程。
- Worker 异常退出后，reconciler 会将 stale running job 重新放回队列。
- 失败任务会退还额度，不计入用户可用额度消耗。
- 参考图原图请求遇到 `413` 或请求体过大时，会自动压缩并在同一任务内重试。

## 常见问题

登录后在 `/login` 和 `/generate` 之间跳转：

- 检查 `APP_URL` 是否与实际访问域名完全一致。
- 修改 `APP_URL` 后清理浏览器中该站点的 Cookie。
- 检查 nginx 是否正确转发 `Host` 和 `X-Forwarded-Proto`。

上传多张参考图时 Sub2API 返回 nginx `413`：

- 确认 Sub2API 域名对应的 HTTPS server block 设置了 `client_max_body_size`。
- 确认请求命中了正确的 `server_name`。
- 查看 nginx 的 `access.log` 和 `error.log`。

Docker Hub 拉取镜像超时：

- 先重试 `docker compose pull`。
- 通过 `NODE_IMAGE`、`POSTGRES_IMAGE`、`REDIS_IMAGE` 指定可信镜像源。
- 通过 `NPM_REGISTRY` 指定可访问的 npm registry。

Worker 重启时仍有任务在生成：

- 查看 `docker compose logs -f worker`。
- 在运维控制台或队列看板查看任务状态。
- 若 Worker 异常中断，reconciler 会在重试次数允许的情况下恢复任务。

## 许可证

当前为私有项目。如需对外分发或开源，请先补充正式许可证。
