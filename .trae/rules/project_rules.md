# Trae 项目规则

本文件由 Trae 每轮注入上下文，作为硬规则执行。

## 工程经验索引（动工前必读，已内联）

经验总索引完整版见 `.agents/ENGINEERING-PLAYBOOK.md`（含每文件摘要+何时读）。本段为精简内联版，Trae 每轮直接可见，不依赖跨目录链接。

### 动工前必读 3 步

1. `npm run sync:gitee` —— 同步远程、看是否有新提交
2. 读 `.agents/HANDOFF.md` 最新留言 —— 其他 Agent 做了什么、别动什么
3. 按任务类型查下方 6 大类对应专题

### 6 大类经验文件清单（按需读对应专题）

**1. 自动生效规则**
- Cursor 读 `.cursor/rules/*.mdc`（9 个：ai-product-engineering / voice-debug-code-first / voice-input-locked / sp-content-depth / deploy-after-update / gitee-collaboration / miniprogram-porting / miniprogram-stability-ux / miniprogram-community-skills）
- Trae 读本文件（`.trae/rules/project_rules.md`）

**2. 深度复盘**
- `.agents/postmortems/2026-07-14-voice-asr-outage.md` —— 语音两次失效完整复盘、排障清单、沟通铁律

**3. 协作流水**
- `.agents/HANDOFF.md` —— 每轮做了什么、验证、风险、下一步
- `AGENTS.md` —— Codex/通用 Agent 入口
- `.agents/ONBOARDING-TRAE.md` —— 给 Trae 的分工（部署主场、联调、排障）
- `.agents/ONBOARDING-CODEX.md` —— 给 Codex 的分工（/api、src/lib/server、Agent pipeline）

**4. 小程序专项**
- `miniprogram/docs/PORTING.md` / `PORTING-SELF-CHECK.md` / `M9-DEVICE-QA.md` / `issue-backlog.md` / `DESIGN-TOKENS.md`

**5. 产品与设计**
- `PRODUCT.md` / `DESIGN.md` / `docs/architecture/agent-memory-workflow.md` / `docs/product/deep-modeling.md` / `docs/contracts/read-contract.md`

**6. Trae 专用计划文档**
- `.trae/documents/` 下：portrait-v3-theory-aligned-rebuild / portrait-v3-fullchain-grounded-rebuild / fullchain-agent-audit-and-portrait-v2 / bff-three-phase-overview / front-agent-sp-redundancy-audit / ai-engineering-rules-persist / impeccable-skill-persist-in-trae / portrait-real-data-validation / sp-chain-depth-spec

### 关键铁律速查（动工前扫一眼）

- **语音链路已锁定**：未授权不改（见 `.cursor/rules/voice-input-locked.mdc` + `.agents/postmortems/2026-07-14-voice-asr-outage.md`）
- **SP 不能是便条骨架**：2026-07-18 铁律（见 `.cursor/rules/sp-content-depth.mdc`）
- **改完可上线代码必 typecheck/build/deploy**（见 `.cursor/rules/deploy-after-update.mdc` + 本文件"收工前必跑"段）
- **全链路契约**：Frontend→BFF→DB→Job→Agent→LLM→UI，字段有 reader/owner/lifecycle（见 `.cursor/rules/ai-product-engineering.mdc`）
- **Web→小程序是 Porting 不是重设计**（见 `.cursor/rules/miniprogram-porting.mdc`）
- **不提交 .env.local/密码/令牌**（见 `AGENTS.md` 禁止段）

## Skills（已自动发现，无需安装）

Trae 自动发现 `.agents/skills/*/SKILL.md` 并注册成可调用 skill。本项目已接入：

- `impeccable` — UI 设计 / 审计 / 打磨 / 重设计 / 新建页面 / 改样式 / 改组件视觉 / 空态 / 动效 / 可访问性
- `miniprogram-dev` — 微信/Taro 小程序平台陷阱（审核、权限、分包、合法域名、rpx、平台 API 差异）
- `wechat-devtools` — 小程序构建 / 预览 / 调试 / 自动化测试

调用方式：`Skill(<name>)`。

## 硬规则：UI 任务必须先加载 Impeccable

凡涉及 `app/`、`src/`、`miniprogram/src/` 下的 **UI 任务**（设计 / 重设计 / 审计 / 打磨 / 新建页面 / 改样式 / 改组件视觉 / 空态 / 动效 / 可访问性 / 主题色 token），在动手写代码前 **必须先 `Skill("impeccable")`**，并遵循其 `SKILL.md` Setup：

1. 每会话跑一次 `node .agents/skills/impeccable/scripts/context.mjs`（打印 PRODUCT.md / DESIGN.md，或提示缺失走 init；已跑过则不重复）。
2. 若用户用了子命令（audit / polish / craft / shape / critique / distill / harden / clarify / colorize / animate / extract / delight / quieter / bolder / optimize / onboard / live / document / adapt / typeset / layout / interaction-design / brand / product），读对应 `reference/<command>.md`。
3. 至少读一个现有 CSS / token / 组件文件，复用既有设计系统。本项目 hi-fi 黄绿 token 在 `app/hifi-app.css` + `DESIGN.md`（旧紫色 AppShell 已废弃，勿恢复）。
4. 读 `reference/product.md`（本项目 design SERVES product，非 brand 站）。
5. 审计命令：`npx impeccable detect app/ src/ miniprogram/src/`。

**不适用**：纯后端 / API / 数据库 / Prompt / Job 队列 / 记忆层任务不调用 impeccable，避免误触发。

## 范围

Web（`app/`、`src/`）+ 小程序（`miniprogram/src/`）。两套 UI 共用 BFF 与 hi-fi 设计语言，但小程序移植另有 `miniprogram-dev` / `wechat-devtools` 负责。

## 收工前必跑（lint / typecheck）

改完代码收工前必须运行并确保通过：

- Web/BFF：`npm run typecheck`（`tsc --noEmit`）+ `npm run lint`（`next lint`）；若改了构建产物相关，加 `npm run build`。
- 小程序：`cd miniprogram && npm run build:weapp`（Taro 构建）；类型检查见 `miniprogram/tsconfig.json`。
- 若发现项目有新的校验命令，先补进本文件再跑，不要凭记忆。

## 环境与协作

- 远程：Gitee `master`；开工先 `npm run sync:gitee`，收工更新 `.agents/HANDOFF.md` 并 `[trae]` 前缀 commit + `git push origin master`。
- 勿提交 `.env.local`、API Key、Gitee 私人令牌、SSH 密码。
- 语音 ASR 链路已锁定（`.cursor/rules/voice-input-locked.mdc`），改动须先征得同意。
