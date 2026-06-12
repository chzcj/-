# AGENTS.md — Cursor / Trae / Codex 协作入口

本项目远程在 **Gitee**：https://gitee.com/heartlab/yujian ，分支 **`master`**。

## 每次开工（必须）

在开始改代码、回答问题涉及「当前状态」或做部署前，先执行：

```bash
npm run sync:gitee
```

阅读输出中的：

- 远程是否有新提交（有则 `git pull origin master`）
- `.agents/HANDOFF.md` 最新留言（其他 Agent 做了什么、别动什么）

详细流程见 [.agents/README.md](.agents/README.md)。

## 每次收工（必须）

1. 更新 [.agents/HANDOFF.md](.agents/HANDOFF.md)
2. Commit：`[cursor]` / `[trae]` / `[codex]` 前缀 + 简要说明
3. `git push origin master`

## 产品与设计

- 产品边界：[PRODUCT.md](PRODUCT.md)
- 设计系统：[DESIGN.md](DESIGN.md)
- UI 改动：使用 `.agents/skills/impeccable/`，先跑 `node .agents/skills/impeccable/scripts/context.mjs`

## 环境与部署

- 运行变量：`.env.local`（勿提交）
- 部署：`deploy.sh` + shell 变量 `SSH_HOST` / `SSH_PASS` / `AUTH_TOKEN`
- 详见 [README.md](README.md)

## 禁止

- 不要把 `.env.local`、API Key、Gitee 私人令牌、SSH 密码写入仓库或 HANDOFF
- 不要假设缺 `DATABASE_URL`；当前项目已配好，以 `.env.local` 为准
