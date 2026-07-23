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

- **全链路契约（全局强制）**：`.cursor/rules/ai-product-engineering.mdc`（alwaysApply）— 前端×Agent×BFF 须 producer/consumer/空转/四层对齐；收工 7 步见 `.cursor/rules/fullchain-contract-check.mdc`
- 产品边界：[PRODUCT.md](PRODUCT.md)
- 设计系统：[DESIGN.md](DESIGN.md)（hi-fi 主站；旧紫色 AppShell 已废弃）
- **技术架构**：[docs/architecture/agent-memory-workflow.md](docs/architecture/agent-memory-workflow.md)（Agent 工作流 · SP · Job · 记忆）
- **高保真迁移**：[docs/architecture/hifi-ui-migration-playbook.md](docs/architecture/hifi-ui-migration-playbook.md)（HTML/mock→TSX 强制六步法 · L1/L2/L3 · 记忆反推）；Cursor 规则 `.cursor/rules/hifi-ui-migration.mdc`（待建，alwaysApply）
- UI 像素参考：[design-reference/README.md](design-reference/README.md)
- 对外合作材料：[docs/outreach/](docs/outreach/)
- **Impeccable（UI）**：已安装于 `.agents/skills/impeccable/`（Cursor 入口：`.cursor/skills/impeccable`）
  - 开工：`node .agents/skills/impeccable/scripts/context.mjs`
  - 更新：`npx impeccable skills update`
  - 审计：`npx impeccable detect app/ src/`
  - Cursor 聊天可用 `/impeccable` 子命令（如 `audit`、`polish`、`craft`）
  - Trae：自动发现 `.agents/skills/*/SKILL.md`，`Skill("impeccable")` 即可调用，无需安装；UI 任务硬规则与收工校验见 `.trae/rules/project_rules.md`
- **小程序 Porting（Web → 微信）**：[miniprogram/docs/PORTING.md](miniprogram/docs/PORTING.md) · Token：[DESIGN-TOKENS.md](miniprogram/docs/DESIGN-TOKENS.md) · 自检：[PORTING-SELF-CHECK.md](miniprogram/docs/PORTING-SELF-CHECK.md) · Cursor 规则：`.cursor/rules/miniprogram-porting.mdc`

## 环境与部署

- 运行变量：`.env.local`（勿提交）
- 部署：`deploy.sh` + shell 变量 `SSH_HOST` / `SSH_PASS` / `AUTH_TOKEN`
- 详见 [README.md](README.md)

## 禁止

- 工程经验总索引（链到 .cursor/rules、postmortems、HANDOFF、小程序专项）：[.agents/ENGINEERING-PLAYBOOK.md](.agents/ENGINEERING-PLAYBOOK.md)
- 不要把 `.env.local`、API Key、Gitee 私人令牌、SSH 密码写入仓库或 HANDOFF
- 不要假设缺 `DATABASE_URL`；当前项目已配好，以 `.env.local` 为准
