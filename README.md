# 育见（yujian）

帮助家长理解青春期孩子的 AI 产品。品牌对外用 **育见**；代码与文档中 ChildOS / 心镜 为同一产品历史名。

线上站点：[https://yujian.yihe.site](https://yujian.yihe.site)  
微信小程序与 Web 共用同一套 BFF。

## 代码仓库

| 远程 | 地址 | 用途 |
|------|------|------|
| **origin（主协作）** | https://gitee.com/heartlab/yujian | Cursor / Trae / Codex 日常同步，分支 `master` |
| **github（镜像）** | `git@github.com:chzcj/-.git` | 备份 / 对外可见；推送用 SSH |

```bash
git clone https://gitee.com/heartlab/yujian.git
cd yujian
git checkout master
git pull origin master
```

### 多 Agent 协作

开工前：

```bash
npm run sync:gitee   # fetch + 打印 .agents/HANDOFF.md
```

收工：更新 `.agents/HANDOFF.md` → commit（前缀 `[cursor]` / `[trae]` / `[codex]`）→ `git push origin master`；需要时再 `git push github master`。

详见 [AGENTS.md](AGENTS.md)、[.agents/README.md](.agents/README.md)。  
**勿把** `.env.local`、API Key、SSH 密码、Gitee Token 写入仓库或 HANDOFF。

## 当前产品结构

主流程以 **hi-fi 四 Tab** 为准（Web：`HiFiMainShell`；小程序同构四 Tab）。旧紫色 `AppShell` 已废弃；旧路由由 `middleware.ts` 重定向到 `/daily`。

### 四 Tab

| 导航 | Web | 小程序 | 功能 |
|------|-----|--------|------|
| 交流 | `/daily` | `pages/daily` | 日常对话：文字 / 按住说话 → 流式理解与建议 |
| 任务 | `/tasks` | `pages/tasks` | 「今晚可试」任务与反馈 |
| 预演 | `/rehearsal` | `pages/rehearsal` | 场景预演；含亲子整段录音分析 |
| 画像 | `/family-profile` | `pages/profile` | 孩子画像 hub、证据、深度、验证 |

### Onboarding（四模块建档）

陌生用户须先完成建档再解锁四 Tab：

```
登录 → intro → basic → hub（四模块采集）→ generating → result → 四 Tab
```

Web：`/login` → `/profile/build/*`  
小程序：`pages/login` → `packageOnboarding/pages/*`

### 登录与隐私（小程序提审要点）

- 登录页隐私协议**默认不勾选**，用户自主勾选后方可「微信登录」
- 仅 `wx.login` 换 openid，**不获取**手机号 / 头像 / 昵称
- 详见 [miniprogram/docs/REVIEW-SUBMISSION.md](miniprogram/docs/REVIEW-SUBMISSION.md)

## 语音（ASR）

| 场景 | 端 | 实现 |
|------|----|------|
| Web 按住说话 | 浏览器 | `wss://…/api/asr/stream`（`server.js` 代理 → 腾讯实时） |
| 小程序按住说话 | 真机 | 讯飞实时转写大模型（方案 A 直连）；BFF 签发 `GET /api/asr/iflytek/url` |
| 亲子整段录音 | 小程序 | 本地 mp3 → `POST /api/rehearsal/dialogue-transcribe`（腾讯文件识别） |

小程序语音链路**已验收锁定**：改 `useTencentAsrInput` / `useTapFileRecorder` / `recorderState` / 讯飞相关文件前须先征得产品同意（见 `.cursor/rules/voice-input-locked.mdc`）。

小程序 socket 合法域名须含：`wss://office-api-ast-dx.iflyaisol.com`。细节见 [miniprogram/README.md](miniprogram/README.md)。

## 本地开发

运行变量以根目录 `.env.local` 为准（已 gitignore，**勿提交**）。

```bash
npm install
npm run asr:dev          # Web：Next + /api/asr/stream（server.js）
# 另开终端
cd miniprogram && npm install && npm run build:weapp
```

- Web：http://localhost:3000/daily  
- 小程序：用微信开发者工具打开 **`miniprogram/`**（`miniprogramRoot: dist/`），不要打开仓库根目录

```bash
npm run check            # validate:env + build + typecheck
curl -s http://localhost:3000/api/readiness | jq
```

## 环境变量（`.env.local`）

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL |
| `NEXT_PUBLIC_USE_MOCK` | 生产为 `false` |
| `FAST_AI_API_KEY` / `FAST_AI_MODEL` | DeepSeek 等日常对话模型 |
| `INTERNAL_API_TOKEN` | 内部 API 鉴权 |
| `IFLYTEK_APP_ID` / `IFLYTEK_API_KEY` / `IFLYTEK_API_SECRET` | 小程序实时 ASR（仅服务端） |
| `TENCENT_APPID` / `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | Web 实时代理 + 亲子文件 ASR |

部署脚本临时变量（勿写入 Git）：`SSH_HOST` / `SSH_PASS` / `AUTH_TOKEN`（与 `INTERNAL_API_TOKEN` 一致）。

```bash
export SSH_HOST="ubuntu@…"
export SSH_PASS="…"
export AUTH_TOKEN="…"
npm run deploy           # 只更新 Web/BFF；小程序需本地 build:weapp 后上传
```

## 线上部署

- PM2 入口：`server.js`（Next + Web ASR WebSocket）
- `deploy.sh`：rsync → 上传 `.env.local` → install → build → 重启 → `/api/readiness`
- 验证：`curl -s https://yujian.yihe.site/api/readiness` 中 `ready: true`

## 主要 API

| 路径 | 用途 |
|------|------|
| `/api/auth/wechat` 等 | 登录 / 会话 |
| `/api/daily/stream` | 交流主入口（NDJSON 流） |
| `/api/rehearsal/analyze` | 预演分析 |
| `/api/rehearsal/dialogue-transcribe` | 亲子录音文件转写 |
| `/api/asr/iflytek/url` | 小程序讯飞 wss 签名 URL |
| `/api/asr/stream` | Web ASR 代理（非 Next route，由 server.js 接管） |
| `/api/asr/token` | Web/兼容：腾讯实时签名（小程序实时已改讯飞） |
| `/api/profile/*`、`/api/synthesis`、`/api/diagnosis` | 画像与建档 |
| `/api/readiness` | 健康检查 |

流式契约：`docs/contracts/daily-stream-events.md`。

## 目录速览

```
app/                    # Next.js 页面与 BFF routes
miniprogram/            # Taro 微信小程序（主端之一）
src/lib/server/         # 日交流、记忆、ASR、Job
server.js               # 生产/开发统一入口 + Web ASR WS
prompts/                # Agent 提示词
docs/                   # 契约、提审、handoff
.agents/HANDOFF.md      # Agent 协作留言
```

## 相关文档

- 产品边界：[PRODUCT.md](PRODUCT.md)
- 设计系统：[DESIGN.md](DESIGN.md)
- 小程序：[miniprogram/README.md](miniprogram/README.md)
- 提审说明：[miniprogram/docs/REVIEW-SUBMISSION.md](miniprogram/docs/REVIEW-SUBMISSION.md)
