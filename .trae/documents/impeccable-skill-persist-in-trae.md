# 把 Impeccable skill 固定化进 Trae

## Summary

Impeccable skill **已经安装且已被 Trae 自动发现并可调用**（`.agents/skills/impeccable/SKILL.md` → 我的 Skill 工具 `available_skills` 列表里就有 `impeccable`）。本计划不做"重新安装"，而是补上唯一缺失的一环：**一条 Trae 项目级规则，强制我在 UI 任务上主动调用 impeccable**，并在 AGENTS.md 里补一行 Trae 用法说明，让协作者知道 Trae 已自动接入、无需安装。

## Current State Analysis（Phase 1 探查结论）

- `.agents/skills/impeccable/` 完整存在并已 commit：`SKILL.md` + 25 个 `reference/*.md` 子命令（audit/polish/craft/critique/shape/distill/harden/clarify/colorize/animate/extract/…）+ `scripts/`（`context.mjs`、`detect.mjs`、`live-*.mjs`、detector/）+ `agents/*.toml`。clone 仓库即得，无需 npm install。
- Trae 已自动发现该 skill：我的 Skill 工具可用列表含 `impeccable`、`miniprogram-dev`、`wechat-devtools`，三者均匹配 `.agents/skills/*/SKILL.md` 模式。调用方式：`Skill("impeccable")`。
- **缺口**：
  1. `.trae/` 目录不存在，`.trae/rules/project_rules.md` 不存在 → 没有任何规则强制我在 UI 任务上先加载 impeccable，目前只靠系统每轮注入的"检查 available_skills"提醒 + 我自觉。
  2. `AGENTS.md` 的「Impeccable（UI）」段落只写了 Cursor 入口（`.cursor/skills/impeccable` + `/impeccable` 子命令），但实际 `.cursor/skills/` 是空的，且完全没提 Trae 怎么用。
- `package.json` 无 impeccable 依赖（独立 .mjs，更新走 `npx impeccable skills update`，非本次范围）。

## Proposed Changes

### 1. 新建 `.trae/rules/project_rules.md`（核心动作）

**为什么**：Trae 项目规则会被注入每轮系统上下文，是"固定化"唯一真正生效的杠杆——不靠我自觉，规则会持续提醒。

**写什么**（精简、可执行）：
- 声明三个项目本地 skill 已被 Trae 自动发现、无需安装：`impeccable`（UI 设计/审计/打磨）、`miniprogram-dev`（小程序平台陷阱）、`wechat-devtools`（构建/预览/调试）。调用方式 `Skill(<name>)`。
- **硬规则**：凡涉及 `app/`、`src/`、`miniprogram/src/` 下的 UI 任务（设计/重设计/审计/打磨/新建页面/改样式/改组件视觉/空态/动效/可访问性），在动手写代码前**必须先 `Skill("impeccable")`**，并遵循其 `SKILL.md` Setup：
  1. 每会话跑一次 `node .agents/skills/impeccable/scripts/context.mjs`（它会打印 PRODUCT.md/DESIGN.md，或提示缺失走 init）；
  2. 若用户用了子命令（audit/polish/craft/shape/critique/distill/harden/clarify/colorize/animate/extract/…），读对应 `reference/<command>.md`；
  3. 至少读一个现有 CSS/token/组件文件，复用既有设计系统（本项目 hi-fi 黄绿 token 在 `app/hifi-app.css` + `DESIGN.md`，勿另起炉灶）；
  4. 读 `reference/product.md`（本项目 design SERVES product，非 brand 站）。
- **范围**：Web（`app/`、`src/`）+ 小程序（`miniprogram/src/`）。审计命令示例：`npx impeccable detect app/ src/ miniprogram/src/`。
- **不适用**：纯后端/API/数据库/Prompt/Job 队列任务不调用 impeccable（避免误触发）。
- 顺带把"收工前跑 lint/typecheck"也写进同一规则文件（系统提示里提到过 `.trae/rules/project_rules.md` 是放这类命令的地方），一并固定化。

### 2. 更新 `AGENTS.md` 的「Impeccable（UI）」段落（轻量补一行）

**为什么**：让 Cursor/Trae/Codex 协作者都知道 Trae 已自动接入，避免有人重复"安装"或误以为 Trae 用不了。

**怎么改**：在该段落末尾追加一行 Trae 说明，不删既有 Cursor 内容：
- "Trae：自动发现 `.agents/skills/*/SKILL.md`，`Skill("impeccable")` 即可调用，无需安装；项目规则见 `.trae/rules/project_rules.md`。"

## Assumptions & Decisions

- **不重新安装 / 不跑 `npx impeccable skills update`**：当前版本已能用，更新属可选维护，不在本次固定化范围（若要更新，单独跑那条命令即可）。
- **不恢复 `.cursor/skills/impeccable`**：那是 Cursor 专属入口，与 Trae 无关，且 AGENTS.md 提的该路径实际已空；如需 Cursor 对齐另开任务。
- **不新建 `.mcp.json` impeccable 条目**：impeccable 是 skill（SKILL.md + scripts），不是 MCP server；它已通过 `.agents/skills/` 机制接入，加 MCP 反而错。
- **覆盖 Web + 小程序**：项目两个 UI 面都活跃（HANDOFF 显示近期同时改 Web 与 miniprogram），impeccable 的 detect 支持多目录。
- 规则文件用中文（与 AGENTS.md / 项目文档一致）。

## Verification

1. `cat .trae/rules/project_rules.md` 确认内容写入。
2. `grep -n "Trae" AGENTS.md` 确认 Trae 用法行已加。
3. 跑一次 context 加载器验证 skill 可执行：`node .agents/skills/impeccable/scripts/context.mjs`（预期打印 PRODUCT.md + DESIGN.md 摘要，或 `NO_PRODUCT_MD`——本项目有 PRODUCT.md，应成功）。
4. 行为验证（下一轮 UI 任务时）：让我"审计交流页样式"，确认我会先 `Skill("impeccable")` 再动手，而不是直接改 CSS。
5. 可选：`npx impeccable detect app/ src/ miniprogram/src/` 跑一遍真实审计，确认脚本链路通（非必须，仅验证）。
