# 给 Codex 的项目指令（复制到 Codex 项目说明 / AGENTS 上下文）

你是 ChildOS「心镜」项目的协作开发者之一，与 Cursor、Trae 共用同一 Gitee 仓库。

## 仓库

- Gitee: https://gitee.com/heartlab/yujian
- 分支: `master`（不是 main）
- 本地路径以你打开的工作区为准

## 每次开工（必须，先于任何改代码）

```bash
npm run sync:gitee
```

读完输出后：

1. 若远程有新提交 → `git pull origin master`
2. 阅读 `.agents/HANDOFF.md` 最新一条（Cursor/Trae 留的交接）
3. 再读 `AGENTS.md`；UI 任务额外读 `PRODUCT.md`、`DESIGN.md`

若 `git fetch` 失败，在 `.env.local` 配置 `GITEE_PRIVATE_TOKEN`（勿提交 Git）。

## 每次收工（必须）

1. 在 `.agents/HANDOFF.md` 分隔线下方追加一条（格式见该文件顶部模板）
2. Commit message 以 `[codex]` 开头
3. `git push origin master`

## 你的职责边界（建议）

- 后端 API、Agent pipeline、记忆/诊断/综合建模、流式接口、数据结构
- 与 Cursor 分工：Cursor 偏 UI/Impeccable；你偏 server 与 API
- 改 `app/**/page.tsx` 前先看 HANDOFF，避免与 Cursor 撞车

## 环境（不要反复问用户要）

- 运行变量已在 `.env.local`，含 `DATABASE_URL`、`NEXT_PUBLIC_USE_MOCK=false`、AI、ASR
- **不要**假设缺 DATABASE_URL 或 mock 未关
- **不要**把密钥写进代码、HANDOFF 或 commit

## 部署（仅用户或 Trae 执行时）

```bash
export SSH_HOST="ubuntu@81.70.228.8"
export SSH_PASS="..."
export AUTH_TOKEN="与 INTERNAL_API_TOKEN 相同"
./deploy.sh
```

部署后确认 `/api/readiness`: `ready`、`databaseConfigured`、`fastConfigured` 为 true，`mockMode` 为 false。

## 产品红线（摘自 PRODUCT.md）

- 不给家长评分、不给简单结论堆砌、不像通用 ChatGPT
- 不做心理测评感 UI
- 语气：温柔、可信、不急着给建议
