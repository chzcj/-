# 工程经验总索引（ENGINEERING-PLAYBOOK）

> 本文件是"我说过的经验"总索引。正文在各专题文件，**按需读**。本文件只做指针，不复制正文（防双源漂移）。
> 三端共用：Cursor 读 [.cursor/rules/](../.cursor/rules/)，Trae 读 [.trae/rules/project_rules.md](../.trae/rules/project_rules.md)（已引用本文件），Codex 读 [AGENTS.md](../AGENTS.md)（已引用本文件）。

---

## 动工前必读 3 步

1. `npm run sync:gitee` —— 同步远程、看是否有新提交、读 HANDOFF 最新留言
2. 读 [.agents/HANDOFF.md](HANDOFF.md) 最新留言 —— 其他 Agent 做了什么、别动什么
3. 按任务类型查本索引对应专题（如下 6 大类）

---

## 1. 自动生效规则（每轮注入）

### Cursor（读 [.cursor/rules/](../.cursor/rules/)*.mdc，frontmatter 格式）

| 文件 | 一句摘要 | 何时读 |
|------|---------|--------|
| [ai-product-engineering.mdc](../.cursor/rules/ai-product-engineering.mdc) | **全局 alwaysApply**：前端×Agent×BFF；producer/consumer/空转/L1–L4；触发范围与禁止项 | 任何触达 Agent/BFF/契约的改动 |
| [fullchain-contract-check.mdc](../.cursor/rules/fullchain-contract-check.mdc) | Agent/契约收工 7 步 + `npm run audit:fullchain` | 改 SP/BFF/契约/读包时 |
| [voice-debug-code-first.mdc](../.cursor/rules/voice-debug-code-first.mdc) | 语音排障默认是代码问题；connectSocket 只调一次；不甩锅域名/网络 | 语音相关排障 |
| [miniprogram-ui-interaction-lessons.mdc](../.cursor/rules/miniprogram-ui-interaction-lessons.mdc) | **全局 alwaysApply**：任务 chip/展开/提交 affordance；禁 catchClick；禁 overflow 吞触摸；昵称 childSystemCopy | 改小程序/Web 任务·反馈·展开 UI |
| [voice-input-locked.mdc](../.cursor/rules/voice-input-locked.mdc) | 语音链路已验收，未授权不能改 | 动语音前必读 |
| [sp-content-depth.mdc](../.cursor/rules/sp-content-depth.mdc) | SP 不能是便条骨架（2026-07-18 铁律） | 写/改任何 SP 时 |
| [deploy-after-update.mdc](../.cursor/rules/deploy-after-update.mdc) | 改完可上线代码要 typecheck/build/deploy | 改完代码收工前 |
| [gitee-collaboration.mdc](../.cursor/rules/gitee-collaboration.mdc) | sync:gitee、HANDOFF、commit 前缀 | 每次开工/收工 |
| [miniprogram-porting.mdc](../.cursor/rules/miniprogram-porting.mdc) | Web→小程序是 Porting，不是重设计 | 小程序移植 |
| [miniprogram-stability-ux.mdc](../.cursor/rules/miniprogram-stability-ux.mdc) | 小程序 P0 问题注册表（滚顶、ASR、遮挡等） | 小程序稳定性 |
| [miniprogram-community-skills.mdc](../.cursor/rules/miniprogram-community-skills.mdc) | 小程序社区技能 | 小程序社区功能 |

### Trae（读 [.trae/rules/project_rules.md](../.trae/rules/project_rules.md)，每轮注入）

含 Skills 声明（impeccable/miniprogram-dev/wechat-devtools）+ UI 任务硬规则 + 收工 lint/typecheck + 环境协作。见 [.trae/rules/project_rules.md](../.trae/rules/project_rules.md)。

---

## 2. 深度复盘（长篇传承）

| 文件 | 内容 | 何时读 |
|------|------|--------|
| [.agents/postmortems/2026-07-14-voice-asr-outage.md](postmortems/2026-07-14-voice-asr-outage.md) | 语音两次失效的完整复盘、排障清单、沟通铁律 | 语音出问题、或想避免重蹈覆辙时 |
| [.agents/postmortems/2026-07-22-tasks-ui-mp-porting-retrospective.md](postmortems/2026-07-22-tasks-ui-mp-porting-retrospective.md) | 任务页/小程序 UI ~30 轮问题、catchClick/overflow 吞触摸、affordance、Agent 反省 | 改任务反馈、展开交互、MP↔Web parity 时 |
| [.agents/README.md](README.md) | .agents 入口索引，指向 postmortem | 第一次了解协作机制时 |

---

## 3. 协作流水（按次记录，不是规则手册）

| 文件 | 内容 | 何时读 |
|------|------|--------|
| [.agents/HANDOFF.md](HANDOFF.md) | 每轮做了什么、验证、风险、下一步（含很多纠正方向后的结论） | 每次开工必读最新留言 |
| [AGENTS.md](../AGENTS.md) | Codex/通用 Agent 入口：Gitee、HANDOFF、产品/设计引用 | 第一次了解项目时 |
| [.agents/ONBOARDING-TRAE.md](ONBOARDING-TRAE.md) | 给 Trae 的分工（部署主场、联调、排障）+ 开工/收工 ritual | Trae 第一次开工 |
| [.agents/ONBOARDING-CODEX.md](ONBOARDING-CODEX.md) | 给 Codex 的分工（/api、src/lib/server、Agent pipeline） | Codex 第一次开工 |

---

## 4. 小程序专项文档

| 文件 | 内容 | 何时读 |
|------|------|--------|
| [miniprogram/docs/PORTING.md](../miniprogram/docs/PORTING.md) | Visual Parity、设计还原 + 平台适配 | Web→小程序移植 |
| [miniprogram/docs/PORTING-SELF-CHECK.md](../miniprogram/docs/PORTING-SELF-CHECK.md) | 每轮 porting 自检清单 | 每轮移植收工前 |
| [miniprogram/docs/M9-DEVICE-QA.md](../miniprogram/docs/M9-DEVICE-QA.md) | 真机 ASR 验收 | ASR 相关验收 |
| [miniprogram/docs/issue-backlog.md](../miniprogram/docs/issue-backlog.md) | 已修 bug 索引 | 排查小程序 bug 时 |
| [miniprogram/docs/DESIGN-TOKENS.md](../miniprogram/docs/DESIGN-TOKENS.md) | 小程序设计 token | 改小程序样式时 |

---

## 5. 产品与设计

| 文件 | 内容 | 何时读 |
|------|------|--------|
| [PRODUCT.md](../PRODUCT.md) | 产品边界 | 涉及产品决策时 |
| [DESIGN.md](../DESIGN.md) | 设计系统（hi-fi 主站；旧紫色 AppShell 已废弃） | 任何 UI 任务 |
| [docs/architecture/agent-memory-workflow.md](../docs/architecture/agent-memory-workflow.md) | Agent 工作流 · SP · Job · 记忆 | 改 Agent/记忆/Job 时 |
| [docs/product/deep-modeling.md](../docs/product/deep-modeling.md) | 深度建模产品宪法 | 改深度画像/dossier 时 |
| [docs/contracts/read-contract.md](../docs/contracts/read-contract.md) | 前后台读取契约 | 改厚包字段时 |
| [docs/contracts/FULLCHAIN-SELF-CHECK.md](../docs/contracts/FULLCHAIN-SELF-CHECK.md) | Agent/契约/BFF 收工 7 步清单 | 改 SP/BFF/契约收工前 |

---

## 6. Trae 专用计划文档（.trae/documents/）

这些是 Trae 会话中产出的思考/检测/计划文档，实施前参考：

| 文件 | 内容 |
|------|------|
| [.trae/documents/portrait-v3-theory-aligned-rebuild.md](../.trae/documents/portrait-v3-theory-aligned-rebuild.md) | 深度画像 v3 理论对齐方案 |
| [.trae/documents/portrait-v3-fullchain-grounded-rebuild.md](../.trae/documents/portrait-v3-fullchain-grounded-rebuild.md) | v3 全链路扎根分析 |
| [.trae/documents/fullchain-agent-audit-and-portrait-v2.md](../.trae/documents/fullchain-agent-audit-and-portrait-v2.md) | 全链路 Agent 检测 + 画像 v2 |
| [.trae/documents/bff-three-phase-overview.md](../.trae/documents/bff-three-phase-overview.md) | BFF 三段式整理（规则编排/组装厚包/LLM） |
| [.trae/documents/front-agent-sp-redundancy-audit.md](../.trae/documents/front-agent-sp-redundancy-audit.md) | 前台 SP 全链路冗余检测（R1-R6，含"要方法就沉默"根因） |
| [.trae/documents/ai-engineering-rules-persist.md](../.trae/documents/ai-engineering-rules-persist.md) | 14 条 AI 工程规则固定化计划 |
| [.trae/documents/impeccable-skill-persist-in-trae.md](../.trae/documents/impeccable-skill-persist-in-trae.md) | Impeccable skill 固定化 |
| [.trae/documents/portrait-real-data-validation.md](../.trae/documents/portrait-real-data-validation.md) | 真实数据校验（待 DBA 核对密码） |
| [.trae/documents/sp-chain-depth-spec.md](../.trae/documents/sp-chain-depth-spec.md) | SP 链深度 spec |

---

## 关键铁律速查（动工前扫一眼）

- **语音链路已锁定**：未授权不改（见 [voice-input-locked.mdc](../.cursor/rules/voice-input-locked.mdc) + [postmortem](postmortems/2026-07-14-voice-asr-outage.md)）
- **SP 不能是便条骨架**：2026-07-18 铁律（见 [sp-content-depth.mdc](../.cursor/rules/sp-content-depth.mdc)）
- **改完可上线代码必 typecheck/build/deploy**（见 [deploy-after-update.mdc](../.cursor/rules/deploy-after-update.mdc) + [project_rules.md](../.trae/rules/project_rules.md) 收工段）
- **全链路契约**：Frontend→BFF→DB→Job→Agent→LLM→UI，字段有 reader/owner/lifecycle（见 [ai-product-engineering.mdc](../.cursor/rules/ai-product-engineering.mdc)）；收工必跑 [fullchain-contract-check.mdc](../.cursor/rules/fullchain-contract-check.mdc) + `npm run audit:fullchain`
- **Web→小程序是 Porting 不是重设计**（见 [miniprogram-porting.mdc](../.cursor/rules/miniprogram-porting.mdc)）
- **不提交 .env.local/密码/令牌**（见 [AGENTS.md](../AGENTS.md) 禁止段）
