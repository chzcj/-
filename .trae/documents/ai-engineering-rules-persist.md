# 固定化 AI 产品工程规则（Trae / Cursor / Codex 三端）

## Summary

用户给出一份精炼的「AI Product Engineering Rules」，约束全链路工程方法论（契约/状态/异步/Agent/LLM/三轮验证/Stop Rule）。本计划把它固定化进项目的三套 Agent 协作入口：Trae（`.trae/rules/project_rules.md` 合并）、Cursor（`.cursor/rules/ai-engineering.mdc` 新建）、Codex（`AGENTS.md` 补引用）。规则文本原样保留，只做去重与格式适配。

## Current State Analysis（Phase 1 探查）

- **Trae**：[`.trae/rules/project_rules.md`](file:///Users/mac/Desktop/育见-2/.trae/rules/project_rules.md) 已存在（上一轮 impeccable 固定化时建），含 Skills 声明、impeccable 硬规则、范围、收工 lint、环境协作。Trae 每轮自动注入此文件。
- **Cursor**：`.cursor/rules/` 目录存在多个 `.mdc`（如 `miniprogram-porting.mdc`、`voice-input-locked.mdc`），但**没有**通用 AI 工程方法论规则。`.cursor/skills/` 为空。
- **Codex**：[`AGENTS.md`](file:///Users/mac/Desktop/育见-2/AGENTS.md) 是 Codex 入口，已有产品/设计/环境/禁止条款，但**没有**全链路工程方法论约束。
- **重叠点**：用户规则第 12 条「Three Round Verification 第一轮 typecheck/build」与现有 `project_rules.md`「收工前必跑 lint/typecheck」语义重叠 → 合并去重，以用户规则的「三轮验证」为上位概念收编现有 lint 段。

## Proposed Changes

### 1. Trae：合并进 `.trae/rules/project_rules.md`（主战场）

**为什么**：Trae 规则应集中一处，分散降低注入价值。用户这份是通用工程方法论，impeccable 是 UI 专项，二者层级不同但同属项目规则。

**怎么改**：在现有文件结构中插入「AI 产品工程规则」作为**主体段落**（置于 Skills 声明之后、impeccable 硬规则之前），原样收录用户给的 14 条。处理重叠：
- 现有「收工前必跑（lint/typecheck）」段落 → 并入用户规则第 12 条「三轮验证 · 第一轮」作为本项目具体命令（`npm run typecheck` / `npm run lint` / `npm run build` / `cd miniprogram && npm run build:weapp`），删去独立段落避免重复。
- 保留 impeccable 硬规则、范围、环境协作段落不变。

### 2. Cursor：新建 `.cursor/rules/ai-engineering.mdc`

**为什么**：Cursor 读 `.cursor/rules/*.mdc`，不读 `.trae/`。需独立一份，格式带 frontmatter（`description`/`globs`/`alwaysApply`）。

**怎么写**：
- frontmatter：`description: AI 产品工程规则（全链路/契约/状态/异步/Agent/LLM/三轮验证）`，`alwaysApply: true`（全局规则，不挂 glob）。
- 正文：复制用户给的 14 条规则原文。
- 在第 12 条补本项目命令（同 Trae）。
- 末尾加一行：「UI 任务另见 `.agents/skills/impeccable/`，Trae 用法见 `.trae/rules/project_rules.md`」。

### 3. Codex：`AGENTS.md` 补一段引用

**为什么**：Codex 读 AGENTS.md，但 AGENTS.md 已较长，不宜整段塞规则。补一段指向，让 Codex 知道有这套方法论约束。

**怎么改**：在 AGENTS.md「## 禁止」段落之前，插入一段：

```
## AI 产品工程规则（Trae / Cursor / Codex 共用）

全链路工程方法论（修改前流程理解/问题分析/修改计划、增量变更、契约优先、
状态机、异步 Job、Agent 工作流、LLM Runtime、前端状态、数据一致性、
可观测性、三轮验证、Final Report、Stop Rule）见：
- Trae：.trae/rules/project_rules.md（每轮自动注入）
- Cursor：.cursor/rules/ai-engineering.mdc
任何需求必须从 Frontend→BFF→Backend→Database→AsyncJob→Agent→LLM→UI 全链路分析，
禁止直接改代码。
```

## Assumptions & Decisions

1. **规则文本原样保留**：用户给的 14 条是精炼版，不擅自改写。只做格式适配（.mdc frontmatter）与去重（lint 段并入第 12 条）。
2. **三端各自一份而非 symlink**：Cursor/Trae/Codex 读取机制不同（.mdc / .md / AGENTS.md），symlink 跨工具不可靠。三份内容主体一致，维护成本可接受（规则稳定，不频繁改）。
3. **`alwaysApply: true`**：用户规则是全局工程约束，不挂特定 glob，所有文件都应生效。
4. **不替换 AGENTS.md 现有内容**：AGENTS.md 的产品/设计/环境段落保留，只新增一段引用。
5. **与 impeccable 规则的关系**：impeccable 是 UI 专项（强制性先加载 skill），AI Engineering Rules 是通用方法论（全链路分析/契约/验证）。二者并行不冲突：UI 任务两者都适用（先 impeccable 加载，再按工程规则全链路改）。
6. **不动 `.cursor/rules/voice-input-locked.mdc`**：那是专项锁定，独立保留。

## Verification

1. `cat .trae/rules/project_rules.md` — 确认 14 条已并入，lint 段已去重，impeccable 段保留。
2. `cat .cursor/rules/ai-engineering.mdc` — 确认 frontmatter + 14 条 + 命令补全。
3. `grep -n "AI 产品工程规则" AGENTS.md` — 确认引用段已加。
4. 三端规则文本一致性人工核对（主体 14 条一字不差）。
5. 行为验证：下次提一个需求，确认我会先输出「当前流程理解 + 问题分析 + 修改计划」再动手（而非直接改代码）。

## 备注

此 plan 与 [`deep-mechanism-rethink-and-portrait-redesign.md`](file:///Users/mac/Desktop/育见-2/.trae/documents/deep-mechanism-rethink-and-portrait-redesign.md) 是两个独立任务：
- 本 plan = 工程规则固定化（执行型，批准后立即落地 3 个文件）
- 深度机制 plan = 思考提案（审阅型，等用户理论资料后迭代）
两者可独立批准与执行。
