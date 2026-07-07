# ChildOS 心镜

帮助家长理解青春期孩子的 AI 产品。通过多入口信息采集和结构化追问，把家庭片段转化为更深的孩子理解。

## 代码仓库

远程仓库托管在 **Gitee**（不是 GitHub）：

| 项 | 值 |
|---|---|
| 地址 | https://gitee.com/heartlab/yujian |
| 默认分支 | `master` |
| 线上站点 | https://yujian.yihe.site |

克隆与同步：

```bash
git clone https://gitee.com/heartlab/yujian.git
cd yujian
git checkout master
git pull origin master
```

多人协作（Cursor / Trae / Codex）以 **Gitee + `git pull` / `git push`** 为同步方式；任务跟踪用 Gitee Issues，不用 GitHub Issues / `gh` CLI。部署走 `deploy.sh`（rsync 本地代码到服务器），不依赖远程 `git pull`。

### 多 Agent 协作（开工前必跑）

三个编程工具统一在动手前扫描 Gitee 远程变化：

```bash
npm run sync:gitee
```

会 `git fetch origin master`、对比本地/远程提交、并打印 `.agents/HANDOFF.md` 最新留言。详见 [AGENTS.md](AGENTS.md) 与 [.agents/README.md](.agents/README.md)。

收工后：更新 `HANDOFF.md` → commit（建议前缀 `[cursor]` / `[trae]` / `[codex]`）→ `git push origin master`。

若本机 `git fetch` 无凭据，在 `.env.local` 设置 `GITEE_PRIVATE_TOKEN`（勿提交 Git）。

## 当前产品结构

主流程以 **hi-fi 四 Tab** 为准（`HiFiMainShell` + `HiFiBottomNav`）。旧路由由 `middleware.ts` 重定向到 `/daily`，勿再恢复紫色心镜 `AppShell` 布局。

### 底部导航（四 Tab）

| 导航 | 页面 | 功能 |
|---|---|---|
| 交流 | `/daily` | 日常对话：语音/文字输入 → thinking 四宫格 → 正文流式 → sections → actions |
| 任务 | `/tasks` | 从交流中沉淀的「今晚可试」任务与反馈 |
| 预演 | `/rehearsal` | 选场景 → 输入准备对孩子说的话 → 分析孩子可能怎么听 |
| 画像 | `/family-profile` | 孩子画像 hub：摘要卡、机制链、本周回顾、深度展开 |

### 新用户 Onboarding（五入口画像）

陌生用户须先完成五入口，再解锁四 Tab：

```
/login → /profile/build/intro → /profile/build/basic → /profile/build（五入口 hub）
  → 各入口采集/追问 → /profile/build/final-follow-up → /profile/generating → /profile/result
  → 解锁 /daily、/tasks、/rehearsal、/family-profile
```

- `/profile/build` — 五入口入口页（学习作业 / 日常节奏 / 亲子沟通 / 情绪压力 / 关系环境）
- `/profile/build/{type}` — 各入口输入页（语音输入 + AI 追问）
- `/profile/build/{type}/follow-up` — AI 追问页
- `/profile/build/{type}/summary` — 阶段总结页
- `/profile/build/final-follow-up` — 最终确认
- `/profile/generating` — 调用 /api/synthesis + /api/diagnosis 生成画像
- `/profile/result` — 画像结果展示

### 旧流程（保留，middleware 重定向，不走底部导航）

- `/home`、`/problem/*`、`/observation` 等 → 重定向 `/daily`
- `/problem/start` → … → `/understanding-card` / `/advice-card` / `/next-step`
- `/rehearsal/input` — 旧流式对话式预演
- `/record-child` — 旧记录入口（非主 Tab）

### 其他页面

- `/login` — 登录/注册/演示模式
- `/observation` — 每日观察（语音输入 → AI 解读）
- `/conflict` / `/conflict/result` — 冲突复盘
- `/child-voice` — 孩子自己说
- `/weekly-report` — 本周周报
- `/profile/evidence` / `/profile/deep` / `/profile/verify` — 画像证据/深层/验证页

## 本地开发

运行环境以项目根目录的 `.env.local` 为准（已在 `.gitignore` 中，**不要提交到 Git**）。当前仓库本地已有完整运行变量，可直接开发，无需每次重新补 `DATABASE_URL` 或 `NEXT_PUBLIC_USE_MOCK`。

```bash
npm install
npm run asr:dev    # 开发服务器（含 WebSocket ASR），入口 server.js
```

打开 `http://localhost:3000/daily`（主 Tab 入口；`/home` 会自动重定向）

生产模式本地预览：`npm run build && npm run asr:start`

### 本地数据库

完整流程（登录、画像持久化、readiness）需要 PostgreSQL。若 `.env.local` 的 `DATABASE_URL` 指向 `127.0.0.1:5432` 而本机未启动数据库，`/api/readiness` 会返回 `ready: false`。

快速启动（Docker）：

```bash
docker run -d --name childos-pg \
  -e POSTGRES_PASSWORD=childos \
  -e POSTGRES_DB=childos \
  -p 5433:5432 pgvector/pgvector:pg16
# .env.local 示例：DATABASE_URL=postgresql://postgres:childos@127.0.0.1:5433/childos
```

也可 SSH 隧道连线上库做联调（勿用于日常开发）。

本地健康检查：

```bash
curl -s http://localhost:3000/api/readiness | jq
```

质量检查（先 build 再 typecheck，避免 `.next/types` 过期）：

```bash
npm run check    # validate:env + build + typecheck
npm run lint     # 需 eslint-config-next（npm install 后可用）
```

## 环境配置

环境变量分两类，不要混用。

### 1. 应用运行变量（`.env.local`）

写在 `.env.local`，供 Next.js、API、数据库、AI、ASR 使用。参考 `.env.example` 了解字段含义；**实际值以本地已有的 `.env.local` 为准**。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL：用户、会话、对话记录、记忆库 |
| `NEXT_PUBLIC_USE_MOCK` | 当前项目为 `false`（走真实后端） |
| `FAST_AI_API_KEY` | DeepSeek Fast AI：日常交流、追问、总结、诊断 agent |
| `FAST_AI_MODEL` | 模型名（默认 `deepseek-v4-flash`） |
| `PARENT_AI_*` / `ARK_API_KEY` | 可选：家长向 prose/section 专用豆包端点；未配置时回落 `FAST_AI_*` |
| `INTERNAL_API_TOKEN` | 内部 API 鉴权 |
| `TENCENT_APPID` | 腾讯云实时语音识别 |
| `TENCENT_SECRET_ID` | 腾讯云 ASR |
| `TENCENT_SECRET_KEY` | 腾讯云 ASR |

**不要把 `.env.local`、API Key、数据库密码提交到 Git。**

### 2. 部署脚本变量（仅执行 `deploy.sh` 时临时设置）

这些变量**不是**应用运行必需项，只在执行部署脚本的 shell 里 `export`，不会写入 `.env.local`：

| 变量 | 说明 |
|---|---|
| `SSH_HOST` | 服务器地址，例如 `ubuntu@81.70.228.8` |
| `SSH_PASS` | 服务器 SSH 密码 |
| `AUTH_TOKEN` | 与 `INTERNAL_API_TOKEN` 相同，供部署后 API 验证 |

```bash
export SSH_HOST="ubuntu@81.70.228.8"
export SSH_PASS="你的服务器密码"
export AUTH_TOKEN="与 INTERNAL_API_TOKEN 相同的值"
./deploy.sh
```

## 线上部署

服务器使用 PM2 管理，启动入口是 `server-ws.js`（支持 WebSocket ASR 语音识别代理）。

`deploy.sh` 会依次：同步代码 → 上传 `.env.local` → `npm install` → `npm run build` → 重启 PM2 → 调用 `/api/readiness` 验证。

### 部署后必须确认

部署完成后检查 `/api/readiness`，须满足：

- `ready: true`
- `databaseConfigured: true`
- `mockMode: false`
- `fastConfigured: true`

```bash
curl -s https://yujian.yihe.site/api/readiness
```

## 依赖关系

### 数据存储

- **PostgreSQL**：用户、会话、记忆记录、家庭画像摘要、周报
- **localStorage**：五入口画像构建过程的草稿缓存（同步写入后端 memory API）

### API 分层

| 路径 | 用途 |
|---|---|
| `/api/auth/*` | 登录/注册/登出/当前用户/演示模式 |
| `/api/conversations/*` | 对话创建和状态 |
| `/api/problem/*` | 问题追问和流式响应 |
| `/api/understanding/*` | 理解卡生成和反馈 |
| `/api/rehearsal/*` | 预演分析和流式预演 |
| `/api/entry/analyze` | 入口 AI 分析 |
| `/api/memory/write` | 记忆写入 |
| `/api/memory/retrieve` | 记忆检索 |
| `/api/synthesis` | 跨入口综合建模 |
| `/api/diagnosis` | 深层诊断 |
| `/api/profile/*` | 画像快照和周报 |
| `/api/daily/stream` | **日常交流主入口**（NDJSON 流式：thinking → prose → sections → actions → final） |
| `/api/daily` | @deprecated 非流式日常（无前端调用，保留兼容） |
| `/api/daily/section-retry` | section 生成失败重试 |
| `/api/daily/memory-status` | 按 traceId 查记忆写入状态 |
| `/api/asr/token` | ASR 鉴权 token |
| `/api/asr/stream` | ASR WebSocket 代理（server-ws.js 处理） |
| `/api/readiness` | 健康检查 |

## 项目目录结构

```
app/                    # Next.js App Router 页面
  api/daily/stream/     # 日常交流 NDJSON 流式 BFF
  daily/                # 交流 Tab（主入口）
  tasks/                # 任务 Tab
  rehearsal/            # 预演 Tab
  family-profile/       # 画像 Tab
  profile/build/        # 五入口画像构建（HiFiBuildShell）
  login/
  ...
src/
  components/hifi/      # HiFiMainShell、HiFiBottomNav、HiFiInputZone
  components/daily/     # 交流气泡、section、深度展开
  lib/daily/            # dailyStreamClient、线程持久化
  lib/server/daily/     # daily-turn-bff、prose-section-stream
  types/daily-stream.ts # 流事件契约（与 docs/contracts/ 对齐）
  ...
docs/contracts/         # daily-stream-events、daily-state-machine 等
```

## 当前状态

- 产品在 `https://yujian.yihe.site` 线上运行（品牌名：**育见** / ChildOS / 心镜）
- 主流程：hi-fi 四 Tab（`/daily` | `/tasks` | `/rehearsal` | `/family-profile`）
- 设计系统：[`DESIGN.md`](DESIGN.md)（hi-fi 黄绿主视觉）；像素参考 [`design-reference/README.md`](design-reference/README.md)
- PostgreSQL 数据库已接入（用户、会话、记忆）
- Fast AI（DeepSeek `deepseek-v4-flash`）已接入；可选豆包 `PARENT_AI_*`
- 日常交流流式契约见 `docs/contracts/daily-stream-events.md`
- 五入口画像流程已实现（localStorage 草稿 + 后端 memory 同步）
- 旧问题梳理流程保留，middleware 重定向至 `/daily`
- 对外合作材料：`docs/outreach/`（支教推广技术说明与意向书）
