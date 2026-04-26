# GPT Image Experience Site

一个小规模图片生成体验站。用户登录后提交 prompt，任务进入 BullMQ 队列，独立 Worker 调用你的 Sub2API `gpt-image-2`，图片保存到私有目录，并通过鉴权 API 预览和下载。

## 一键启动

```bash
chmod +x start.sh
./start.sh
```

首次运行会自动创建 `.env` 并生成 `SESSION_SECRET`。然后编辑 `.env`：

```env
SUB2API_BASE_URL=http://host.docker.internal:8080
SUB2API_API_KEY=你的Sub2API密钥
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=换成强密码
```

再次运行：

```bash
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
