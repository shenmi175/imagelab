# 图片生成体验站开发文档 v0.3

目标：在当前可生成、可预览、可下载的基础上，把站点从 MVP 页面升级为成熟的图片生成体验站。v0.3 不改变核心后端架构，重点是 UI 布局、交互体验、主题系统、生成计时、图库和任务工作流。

当前已具备：

```text
Better Auth 登录 / 注册 / 会话
邀请码注册
Cloudflare Turnstile 可选接入
PostgreSQL + Prisma
Redis + BullMQ
Worker 异步调用 Sub2API
私有图片存储
鉴权预览和下载
Bull Board 队列看板
Docker Compose 一键启动
```

v0.3 的核心方向：

```text
引入成熟组件体系
重构应用布局为工作台
生成页改为专业创作面板
增加图库页和任务详情抽屉
增加白天 / 黑夜两套主题背景
生成中展示实时计时
完成后展示排队耗时、生成耗时、总耗时
把错误和队列状态转成用户可理解的提示
```

---

## 1. 版本边界

### 1.1 v0.3 要做

```text
UI 组件体系升级。
App Shell：侧边栏、顶部栏、用户菜单、额度状态。
Generate Workspace：prompt、参数、模板、任务状态、结果预览集中在一个页面。
Gallery：展示历史生成图片，支持状态筛选、下载、复制 prompt、重新生成。
Job Detail Drawer：任务详情从独立简陋页升级为详情抽屉或弹窗。
Day / Night 两套主题，可手动切换并持久化。
生成任务计时：排队时间、生成时间、总耗时。
更清晰的 Loading、Skeleton、Toast、错误提示。
后台管理 UI 分区优化。
```

### 1.2 v0.3 暂不做

```text
支付充值。
公开社区广场。
图生图 / 局部重绘。
多模型计价。
团队空间。
对象存储迁移。
移动端原生 App。
```

### 1.3 后端原则

```text
浏览器仍然不能直接调用 Sub2API。
SUB2API_API_KEY 仍然只在服务端和 Worker 使用。
图片仍然不能静态公开。
任务仍然异步执行，不让 HTTP 请求等待图片生成完成。
额度、并发和队列一致性仍然由数据库事务和 Outbox 保证。
```

---

## 2. 推荐 UI 技术栈

### 2.1 组件体系

采用：

```text
shadcn/ui
Radix UI primitives
Tailwind CSS
lucide-react icons
sonner toast
next-themes
TanStack Query
react-hook-form
zod
```

选择理由：

```text
shadcn/ui 不是黑盒组件库，组件代码进入仓库，方便改成自己的品牌风格。
Radix 提供可访问性基础，适合 Dialog、Dropdown、Tabs、Tooltip、Popover。
Tailwind 已在项目中使用，迁移成本低。
next-themes 适合 Next.js 主题切换，并能减少 hydration 问题。
TanStack Query 适合任务轮询、缓存、重试和状态同步。
react-hook-form + zod 适合生成参数、登录注册、后台表单统一校验。
```

第一批建议安装组件：

```text
button
input
textarea
select
card
badge
tabs
dialog
drawer 或 sheet
dropdown-menu
tooltip
popover
separator
skeleton
progress
toast / sonner
avatar
scroll-area
```

---

## 3. 信息架构

### 3.1 Public 区

页面：

```text
/login
/register
```

后续可增加：

```text
/landing 或 /
```

Landing 页面内容：

```text
产品定位：私有 AI 图片生成体验站。
示例图展示。
支持尺寸和质量说明。
邀请码注册入口。
使用规则。
```

### 3.2 App 区

登录后使用统一 `AppLayout`：

```text
左侧 Sidebar：
  生成
  图库
  任务
  管理员入口，仅 ADMIN 显示

顶部 Topbar：
  当前额度
  当前队列状态
  Day / Night 主题切换
  用户菜单

主内容区：
  根据路由显示工作台、图库、任务、后台
```

路由建议：

```text
/generate          生成工作台
/gallery           图片图库
/jobs              任务列表
/jobs/:id          任务详情，保留直接访问能力
/admin             管理后台
```

### 3.3 Admin 区

后台仍然放在主应用内，但视觉上区分普通用户工作台：

```text
概览：今日任务、成功率、失败率、队列长度、活跃 Worker。
用户：搜索、禁用、额度调整。
邀请码：生成、复制、使用状态。
任务：失败原因、用户、耗时、删除图片。
队列：外链到 Bull Board。
```

---

## 4. 视觉方向

当前 UI 偏 MVP，下一版需要形成明确的“图像实验室 / 创作工作台”风格。

### 4.1 设计关键词

```text
成熟
清晰
强视觉
低干扰
有创作感
有结果展示
移动端可用
```

### 4.2 不采用的方向

```text
不要默认白底表单堆叠。
不要把所有页面都做成相同 card。
不要依赖浏览器默认字体。
不要只用单色背景。
不要在生成中只显示“加载中”。
不要失败时只显示“服务器错误”。
```

### 4.3 推荐视觉结构

```text
背景使用大面积渐变、柔和光斑、细噪点或网格纹理。
主内容使用半透明面板，但避免过度玻璃拟态。
结果图片区域要足够大，优先展示成果。
参数设置放在侧栏，避免打断 prompt 输入。
状态用 Badge、Progress、Timeline 表示。
移动端改为单列，参数使用 Sheet 展开。
```

---

## 5. Day / Night 主题系统

### 5.1 功能要求

```text
用户可在白天和黑夜两种主题之间切换。
主题选择持久化到 localStorage。
刷新页面后保持用户选择。
切换时背景、文字、卡片、边框、按钮、状态色全部同步变化。
主题切换按钮放在 Topbar。
登录页和注册页也使用同一主题系统。
```

### 5.2 实现建议

使用 `next-themes`，但不使用通用的 `light/dark` 命名，使用业务更明确的：

```text
day
night
```

Provider 设计：

```tsx
<ThemeProvider
  attribute="data-theme"
  defaultTheme="day"
  themes={["day", "night"]}
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

根布局：

```text
html 添加 suppressHydrationWarning。
body 不直接写死背景颜色，而是使用 CSS variables。
```

### 5.3 CSS Token

使用语义变量，不在组件里写死颜色：

```css
:root,
[data-theme="day"] {
  --bg: #f5ead8;
  --bg-soft: #fff7ea;
  --panel: rgba(255, 250, 238, 0.84);
  --text: #1f1b16;
  --text-muted: #786f62;
  --line: rgba(57, 43, 27, 0.14);
  --primary: #b54728;
  --primary-foreground: #fff8ea;
  --accent: #2e6f68;
  --success: #2e6f68;
  --warning: #b97921;
  --danger: #9b2c1f;
}

[data-theme="night"] {
  --bg: #0d1110;
  --bg-soft: #141b1a;
  --panel: rgba(18, 24, 23, 0.86);
  --text: #f4efe6;
  --text-muted: #a99f91;
  --line: rgba(244, 239, 230, 0.13);
  --primary: #f08a5d;
  --primary-foreground: #1b100b;
  --accent: #72d0c6;
  --success: #72d0c6;
  --warning: #e4b866;
  --danger: #ff8b7d;
}
```

背景变量：

```css
[data-theme="day"] body {
  background:
    radial-gradient(circle at top left, rgba(181, 71, 40, 0.22), transparent 32rem),
    radial-gradient(circle at bottom right, rgba(46, 111, 104, 0.18), transparent 36rem),
    linear-gradient(135deg, #fbf4e7 0%, #eadabe 100%);
}

[data-theme="night"] body {
  background:
    radial-gradient(circle at top left, rgba(114, 208, 198, 0.18), transparent 30rem),
    radial-gradient(circle at bottom right, rgba(240, 138, 93, 0.14), transparent 36rem),
    linear-gradient(135deg, #0b0f0e 0%, #17211f 100%);
}
```

### 5.4 验收标准

```text
切换主题不刷新页面。
切换主题没有明显闪屏。
所有页面可读性合格。
夜间主题下图片预览边框、按钮、输入框都清晰。
移动端也能切换主题。
```

---

## 6. 生成计时和耗时展示

### 6.1 目标

用户提交任务后必须明确知道：

```text
任务是否已创建。
当前是否在排队。
当前是否正在生成。
已经等待了多久。
真正生成耗时多久。
总共耗时多久。
```

### 6.2 现有字段

当前 `ImageJob` 已有足够字段，不需要数据库迁移：

```text
createdAt
queuedAt
startedAt
completedAt
status
```

耗时计算：

```text
排队耗时 = startedAt - createdAt
生成耗时 = completedAt - startedAt
总耗时 = completedAt - createdAt
当前等待时间 = now - createdAt，适用于 PENDING_ENQUEUE / QUEUED
当前生成时间 = now - startedAt，适用于 RUNNING
```

如果 `queuedAt` 比 `createdAt` 更适合展示，也可以增加：

```text
入队耗时 = queuedAt - createdAt
队列等待 = startedAt - queuedAt
```

### 6.3 API 返回建议

`publicJob()` 增加计算字段：

```ts
type PublicJob = {
  id: string;
  status: JobStatus;
  createdAt: Date;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  queueDurationMs: number | null;
  generationDurationMs: number | null;
  totalDurationMs: number | null;
};
```

服务端计算规则：

```text
如果 startedAt 存在，queueDurationMs = startedAt - createdAt。
如果 startedAt 和 completedAt 都存在，generationDurationMs = completedAt - startedAt。
如果 completedAt 存在，totalDurationMs = completedAt - createdAt。
如果字段不存在，返回 null。
```

前端仍然需要实时计时：

```text
PENDING_ENQUEUE / QUEUED：显示“排队中 00:23”。
RUNNING：显示“生成中 01:12”。
COMPLETED：显示“生成耗时 01:48，总耗时 02:11”。
FAILED：显示“失败前耗时 00:36”。
```

### 6.4 UI 展示方式

生成工作台右侧状态卡：

```text
任务状态 Badge
队列阶段 Timeline
实时计时数字
预计说明：图片生成通常需要几十秒到数分钟
完成后显示下载按钮
失败后显示原因和“重新生成”按钮
```

任务详情抽屉：

```text
创建时间
入队时间
开始生成时间
完成时间
排队耗时
生成耗时
总耗时
尝试次数
上游 request id，仅管理员可见
```

图库卡片：

```text
图片缩略图
状态
尺寸 / 质量
生成耗时
创建时间
下载 / 复制 prompt / 重新生成
```

### 6.5 计时组件

新增组件：

```text
components/job/JobTimer.tsx
components/job/JobTimeline.tsx
components/job/JobStatusBadge.tsx
```

`JobTimer` 规则：

```text
使用 requestAnimationFrame 或 setInterval(1000) 即可。
页面不可见时暂停或降频。
终态任务不启动定时器。
时间格式为 mm:ss，超过 1 小时显示 hh:mm:ss。
```

---

## 7. 生成工作台布局

### 7.1 桌面端布局

```text
┌──────────────────────────────────────────────────────────┐
│ Topbar：额度 / 队列 / 主题 / 用户                         │
├───────────────┬──────────────────────────────┬───────────┤
│ 左侧模板区     │ 中间创作区                    │ 右侧状态区 │
│ 风格预设       │ Prompt textarea              │ 当前任务    │
│ 示例 prompt    │ 图片预览 / 空状态 / 生成中      │ 计时器      │
│ 最近使用       │ 提交按钮                      │ 参数摘要    │
└───────────────┴──────────────────────────────┴───────────┘
```

### 7.2 移动端布局

```text
顶部保留 Logo、主题切换、用户菜单。
主区域先显示 Prompt 和提交按钮。
参数设置使用 Sheet 从底部弹出。
模板和历史任务使用 Tabs。
生成状态卡固定在提交按钮下方。
```

### 7.3 Prompt 区

功能：

```text
多行输入。
字符计数。
最大长度提示。
一键清空。
复制上次 prompt。
提交前显示内容规则。
```

后续增强：

```text
Prompt 模板。
风格预设。
构图预设。
用途预设：海报、头像、产品图、信息图、壁纸。
```

### 7.4 参数区

字段：

```text
尺寸：1024x1024、1536x1024、1024x1536
质量：low、medium、high
格式：MVP 固定 png，不暴露给普通用户
模型：MVP 固定 gpt-image-2，不暴露给普通用户
```

展示方式：

```text
使用 segmented control 或 card radio，不再使用原生 select。
每个选项附带说明，例如“方图 / 横图 / 竖图”。
质量说明成本和速度影响。
```

---

## 8. 图库页

### 8.1 路由

```text
/gallery
```

### 8.2 功能

```text
展示当前用户所有任务。
默认只突出 COMPLETED 图片。
可筛选：全部、生成中、完成、失败、已过期。
可按创建时间排序。
点击图片打开 Job Detail Drawer。
支持下载。
支持复制 prompt。
支持重新生成。
失败任务显示失败原因。
```

### 8.3 卡片内容

```text
缩略图或状态占位。
Prompt 前 80 字。
尺寸和质量。
状态 Badge。
生成耗时。
创建时间。
快捷操作按钮。
```

### 8.4 空状态

```text
没有图片时显示高质量空状态插画区域。
提供“开始生成第一张图片”按钮。
给出 3 个可点击 prompt 示例。
```

---

## 9. 任务状态和轮询

### 9.1 使用 TanStack Query

替换当前手写 `useEffect + setInterval` 轮询。

任务详情查询：

```text
终态：COMPLETED / FAILED / CANCELED / EXPIRED，停止轮询。
非终态：每 2 到 3 秒轮询。
页面不可见时暂停或降频。
网络错误时退避。
```

### 9.2 状态映射

用户可读状态：

```text
PENDING_ENQUEUE -> 正在入队
QUEUED          -> 排队中
RUNNING         -> 正在生成
COMPLETED       -> 已完成
FAILED          -> 生成失败
CANCELED        -> 已取消
EXPIRED         -> 图片已过期
```

### 9.3 错误提示

不要只显示后端原始错误。前端需要映射：

```text
NETWORK_ERROR / fetch failed：
  图片服务暂时无法连接，请稍后重试。

UPSTREAM_TIMEOUT：
  图片生成超时，额度已退还。

UPSTREAM_429：
  上游繁忙或限速，请稍后再试。

AUTH_FAILED：
  图片服务密钥无效，请联系管理员。

CONTENT_POLICY：
  Prompt 可能违反内容规则，请修改后重试。
```

管理员详情中可以显示：

```text
errorCode
upstreamStatus
upstreamRequestId
原始错误摘要
```

---

## 10. 后台管理 UI

### 10.1 总览

```text
今日创建任务数。
今日成功任务数。
今日失败任务数。
平均生成耗时。
当前 QUEUED 数。
当前 RUNNING 数。
活跃 Worker 数。
Bull Board 入口。
```

### 10.2 用户管理

```text
搜索 email。
显示 role、dailyQuota、isDisabled、任务数、注册时间。
快速加减额度。
禁用 / 启用。
后续增加改密和重置 session。
```

### 10.3 任务管理

```text
按状态筛选。
按用户筛选。
显示耗时。
显示失败原因。
支持删除任务和图片。
支持复制 job id。
```

---

## 11. API 调整清单

### 11.1 `PublicJob`

增加：

```text
queueDurationMs
generationDurationMs
totalDurationMs
statusLabel
```

保留：

```text
createdAt
queuedAt
startedAt
completedAt
imageUrl
downloadUrl
```

### 11.2 新增 `GET /api/admin/stats`

当前已有基础统计，v0.3 增强：

```text
averageGenerationDurationMs
averageQueueDurationMs
activeWorkers
queuedJobs
runningJobs
failedToday
completedToday
```

### 11.3 新增 `POST /api/image-jobs/:id/rerun`

用于图库和失败任务重新生成：

```text
必须登录。
普通用户只能 rerun 自己的任务。
读取旧任务 prompt、size、quality。
重新走创建任务事务和额度检查。
返回新 job。
```

如果不想增加 API，也可以前端复制旧参数后跳转 `/generate` 并预填。

---

## 12. 文件结构建议

```text
app/
  (auth)/
    login/
    register/
  (app)/
    layout.tsx
    generate/
    gallery/
    jobs/
    admin/

components/
  app/
    AppSidebar.tsx
    Topbar.tsx
    ThemeToggle.tsx
    UserMenu.tsx
    QuotaPill.tsx
  generate/
    PromptEditor.tsx
    ParameterPanel.tsx
    TemplateRail.tsx
    GenerationWorkspace.tsx
  gallery/
    GalleryGrid.tsx
    GalleryCard.tsx
    GalleryFilters.tsx
  job/
    JobTimer.tsx
    JobTimeline.tsx
    JobStatusBadge.tsx
    JobDetailDrawer.tsx
  admin/
    AdminStats.tsx
    UserTable.tsx
    JobTable.tsx
    InviteCodePanel.tsx
  theme/
    ThemeProvider.tsx
    ThemeToggle.tsx
  ui/
    shadcn components

lib/
  duration.ts
  status-labels.ts
  query-client.ts
```

---

## 13. 开发顺序

### 阶段 1：组件和主题基础

```text
安装 shadcn/ui 基础配置。
安装 next-themes、lucide-react、sonner。
创建 ThemeProvider。
实现 Day / Night 主题 token。
实现 ThemeToggle。
重构 globals.css，移除大部分页面 inline style。
```

验收：

```text
登录页、注册页、dashboard 在 day/night 下都可读。
刷新后主题保持。
无明显 hydration warning。
```

### 阶段 2：App Shell

```text
新增 AppLayout。
实现 Sidebar、Topbar、UserMenu、QuotaPill。
普通用户和管理员菜单区分。
移动端 Sidebar 改 Sheet。
```

验收：

```text
桌面端导航清晰。
移动端不横向溢出。
管理员入口只对 ADMIN 显示。
```

### 阶段 3：生成工作台

```text
重构 /generate。
PromptEditor。
ParameterPanel。
TemplateRail。
提交后在当前页面展示任务状态，不强制跳转。
保留跳转到 /jobs/:id 的能力。
```

验收：

```text
创建任务后 1 秒内看到任务卡片。
排队中显示实时等待时间。
生成中显示实时生成时间。
完成后直接看到图片和下载按钮。
```

### 阶段 4：计时和任务详情

```text
增加 duration 工具。
publicJob 增加耗时字段。
新增 JobTimer、JobTimeline、JobDetailDrawer。
任务列表和详情展示耗时。
```

验收：

```text
RUNNING 时秒表递增。
COMPLETED 后秒表停止。
刷新页面后仍能根据 startedAt/completedAt 显示正确耗时。
FAILED 任务显示失败前耗时。
```

### 阶段 5：图库

```text
新增 /gallery。
实现 GalleryGrid。
实现状态筛选。
实现下载、复制 prompt、重新生成。
```

验收：

```text
完成图片以网格展示。
失败任务不会破坏布局。
点击卡片打开详情。
移动端两列或单列自适应。
```

### 阶段 6：后台 UI 优化

```text
AdminStats。
UserTable。
JobTable。
InviteCodePanel。
Bull Board 入口保留。
失败原因和耗时进入任务表。
```

---

## 14. 验收标准

v0.3 完成标准：

```text
站点有明确的工作台布局，不再是几个简单表单页面。
白天和黑夜主题都可用，并能手动切换。
生成任务时能看到实时计时。
生成完成后能看到生成耗时和总耗时。
图库页可以查看历史图片。
失败任务有可理解的错误提示。
移动端可以完整使用生成、查看、下载流程。
Sub2API key 不出现在前端。
图片仍然通过鉴权 API 访问。
Better Auth、Turnstile、Bull Board 保持可用。
```

---

## 15. 测试计划

### 15.1 UI 手工测试

```text
Day theme 下登录、注册、生成、图库、后台可读。
Night theme 下登录、注册、生成、图库、后台可读。
刷新页面后主题保持。
移动端打开侧边导航正常。
Prompt 超长时显示错误。
提交任务后计时开始。
任务完成后计时停止。
下载按钮可用。
失败任务显示可读错误。
```

### 15.2 API 测试

```text
GET /api/image-jobs 返回 duration 字段。
GET /api/image-jobs/:id 返回 duration 字段。
RUNNING 任务 duration 字段允许为 null，前端实时计算。
COMPLETED 任务 generationDurationMs 不为空。
普通用户不能访问他人任务。
管理员可以访问任意任务。
```

### 15.3 Docker 验收

```text
docker compose up -d --build 正常。
app healthcheck 正常。
worker 能访问 SUB2API_BASE_URL。
Bull Board 仍需 Basic Auth。
```

---

## 16. 参考资料

```text
shadcn/ui Next.js dark mode：
https://ui.shadcn.com/docs/dark-mode/next

shadcn/ui theming：
https://ui.shadcn.com/docs/theming

TanStack Query polling：
https://tanstack.com/query/v5/docs/framework/react/guides/query-options

React Hook Form：
https://react-hook-form.com/get-started

Zod resolvers：
https://github.com/react-hook-form/resolvers
```
