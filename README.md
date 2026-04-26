# GPT Image Experience Site

一个小规模图片生成体验站。用户登录后提交 prompt，任务进入 BullMQ 队列，独立 Worker 调用你的 Sub2API `gpt-image-2`，图片保存到私有目录，并通过鉴权 API 预览和下载。

## 一键启动

```bash
chmod +x start.sh
./start.sh
```

首次运行会自动创建 `.env` 并生成 `SESSION_SECRET`。然后编辑 `.env`：
首次终端输出会显示随机管理员密码和 Bull Board 密码。

```env
SUB2API_BASE_URL=http://host.docker.internal:8080
SUB2API_API_KEY=你的Sub2API密钥
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=首次自动生成或你自己设置的强密码
QUEUE_BOARD_USERNAME=admin
QUEUE_BOARD_PASSWORD=首次自动生成或你自己设置的强密码
```

再次运行：

```bash
./start.sh
```

如果服务器拉取 Docker Hub 镜像超时，例如 `redis:7-alpine` 报 `context deadline exceeded`，这是服务器到 Docker Hub 的网络问题，不是项目代码问题。可以先重试：

```bash
docker compose pull redis
./start.sh
```

如果仍然失败，把 `.env` 里的镜像改成你信任且服务器可访问的镜像仓库地址：

```env
NODE_IMAGE=你的镜像仓库/library/node:22-bookworm-slim
POSTGRES_IMAGE=你的镜像仓库/library/postgres:16-alpine
REDIS_IMAGE=你的镜像仓库/library/redis:7-alpine
NPM_REGISTRY=https://registry.npmmirror.com/
```

也可以在一台能访问 Docker Hub 的机器上预先拉取并导出基础镜像，再传到服务器导入：

```bash
docker pull node:22-bookworm-slim postgres:16-alpine redis:7-alpine
docker save node:22-bookworm-slim postgres:16-alpine redis:7-alpine -o imagelab-base-images.tar
scp imagelab-base-images.tar root@你的服务器:/root/imagelab/
docker load -i imagelab-base-images.tar
./start.sh
```

访问：

```text
http://localhost:3005
```

默认会创建管理员账号和 5 个邀请码。管理员登录后访问：

```text
http://localhost:3005/admin
```

队列看板使用 Bull Board，默认地址：

```text
http://localhost:3006/admin/queues
```

如果已经初始化过数据库后还需要重置管理员密码：

```bash
# 修改 .env 中 ADMIN_PASSWORD，并临时设置：
ADMIN_RESET_PASSWORD=true
docker compose run --rm migrate
# 重置完成后把 ADMIN_RESET_PASSWORD 改回 false
```

## 本机开发

```bash
npm install
docker compose up -d postgres redis
npm run prisma:dev
npm run seed
npm run dev
```

另开终端启动 Worker：

```bash
npm run worker
```

## 关键安全设计

- Sub2API key 只存在后端和 Worker 环境变量中，不返回给前端。
- 图片文件不通过静态目录公开，预览和下载都走鉴权 API。
- 登录注册由 Better Auth 管理账号、密码和会话。
- 登录注册可配置 Cloudflare Turnstile，开启 `TURNSTILE_SITE_KEY` 和 `TURNSTILE_SECRET_KEY` 后生效。
- Bull Board 独立服务运行，并使用 Basic Auth 保护。
- 创建任务使用 PostgreSQL advisory lock，避免并发绕过每日额度和 active job 限制。
- 使用 `QueueOutbox` 恢复 DB 成功但 Redis 入队失败的任务。
- Worker 使用 `lockExpiresAt` 和 reconciler 恢复崩溃后卡住的 `RUNNING` 任务。

## 常用命令

```bash
docker compose logs -f app worker
docker compose exec app npm run cleanup
docker compose down
docker compose down -v
```
