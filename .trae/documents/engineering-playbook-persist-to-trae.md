# 工程经验总索引固定化到 Trae

## Summary

用户反馈：我之前沉淀的"编程经验"散落在 6 类位置（`.cursor/rules/*.mdc` 9 个、`.agents/postmortems/`、`.agents/HANDOFF.md`、`AGENTS.md`、`.trae/rules/project_rules.md`、`miniprogram/docs/`），**没有一份总索引**。Trae 动工前只读到 `.trae/rules/project_rules.md`（Impeccable + 收工校验 + Gitee），读不到 Cursor 那 9 条 .mdc 规则、postmortem 复盘、ONBOARDING-TRAE 分工等关键经验。

本计划：新建 `.agents/ENGINEERING-PLAYBOOK.md` 作为**经验总索引正文**（链到各专题文件，不复制内容），并在 `.trae/rules/project_rules.md` 顶部加"工程经验索引"段引用它，让 Trae 每轮注入时能看到索引、动工前按需读对应专题。不复制规则正文（避免双源漂移），只做**指针索引**。

## Current State Analysis（Phase 1 探查结论）

- **Cursor 规则**（9 个 .mdc，全存在）：`ai-product-engineering`/`voice-debug-code-first`/`voice-input-locked`/`sp-content-depth`/`deploy-after-update`/`gitee-collaboration`/`miniprogram-porting`/`miniprogram-stability-ux`/`miniprogram-community-skills`。frontmatter 格式 `description`+`alwaysApply: true`。**Trae 不读这个目录**。
- **Trae 规则**：`.trae/rules/project_rules.md` 已存在（上一轮 impeccable 固定化时建），含 Skills 声明 + impeccable 硬规则 + 收工 lint + 环境协作。**没有工程经验索引段**。
- **深度复盘**：`.agents/postmortems/2026-07-14-voice-asr-outage.md` 存在（语音两次失效完整复盘）。
- **协作入口**：`.agents/HANDOFF.md`（每轮流水）+ `AGENTS.md`（Codex 入口）+ `.agents/ONBOARDING-TRAE.md`（给 Trae 的分工，但 Trae 不自动读）+ `.agents/ONBOARDING-CODEX.md`。
- **小程序专项**：`miniprogram/docs/` 下 20+ 文档（PORTING/PORTING-SELF-CHECK/M9-DEVICE-QA/issue-backlog 等）。
- **缺口**：没有一份"我说过的经验"总索引；Trae 动工前看不到 Cursor 那 9 条规则与 postmortem。

## Proposed Changes

### 1. 新建 `.agents/ENGINEERING-PLAYBOOK.md`（总索引正文）

**为什么放 `.agents/`**：这是三端（Cursor/Trae/Codex）共用区，AGENTS.md 已在此目录，ONBOARDING-* 也在此。放这里三端都能引用，不偏任一端。

**内容结构**（指针索引，不复制正文）：
- 顶部一句：本文件是经验总索引，正文在各专题文件，按需读。
- 6 大类分区，每类列文件 + 一句说明 + 何时该读：
  1. **自动生效规则**：`.cursor/rules/*.mdc`（Cursor 自动读）+ `.trae/rules/project_rules.md`（Trae 自动读）。9 条 .mdc 逐条列名+一句摘要。
  2. **深度复盘**：`.agents/postmortems/2026-07-14-voice-asr-outage.md`（语音失效复盘+排障清单+沟通铁律）。
  3. **协作流水**：`.agents/HANDOFF.md`（每轮做了什么）+ `AGENTS.md`（Codex 入口）+ `.agents/ONBOARDING-TRAE.md`（Trae 分工）+ `.agents/ONBOARDING-CODEX.md`。
  4. **小程序专项**：`miniprogram/docs/PORTING.md` + `PORTING-SELF-CHECK.md` + `M9-DEVICE-QA.md` + `issue-backlog.md`。
  5. **产品与设计**：`PRODUCT.md` + `DESIGN.md` + `docs/architecture/agent-memory-workflow.md` + `docs/product/deep-modeling.md`。
  6. **Trae 专用计划文档**：`.trae/documents/` 下的 portrait-v3 / bff-three-phase / front-agent-sp-redundancy-audit / ai-engineering-rules-persist 等。
- 末尾"动工前必读 3 步"：① `npm run sync:gitee` ② 读 HANDOFF 最新留言 ③ 按任务类型查本索引对应专题。

### 2. 更新 `.trae/rules/project_rules.md`（加索引段）

**为什么**：Trae 每轮只自动注入这个文件。在顶部加一段"工程经验索引"，让 Trae 动工前知道有 PLAYBOOK 可查。

**怎么改**：在"## Skills"段之前，插入一段：
```
## 工程经验索引（动工前按需读）

经验总索引见 `.agents/ENGINEERING-PLAYBOOK.md`（6 大类：自动规则/深度复盘/协作流水/小程序专项/产品设计/Trae 计划文档）。
- 动工前必读 3 步：① npm run sync:gitee ② 读 .agents/HANDOFF.md 最新留言 ③ 按任务类型查 PLAYBOOK 对应专题。
- 关键铁律速查：语音链路已锁定（未授权不改，见 .cursor/rules/voice-input-locked.mdc）；SP 不能是便条骨架（见 .cursor/rules/sp-content-depth.mdc）；改完可上线代码必 typecheck/build/deploy（见 .cursor/rules/deploy-after-update.mdc）；全链路契约（见 .cursor/rules/ai-product-engineering.mdc）。
```

不删现有 Skills/impeccable/lint/协作段，只新增。

### 3. 更新 `AGENTS.md`（补一行极简引用）

**为什么**：AGENTS.md 是 Codex/通用入口，应让 Codex 也知道有总索引。

**怎么改**：在"## 禁止"段之前加**一行极简引用**（不展开内容，避免稀释 AGENTS.md 信噪比——Cursor 每次读这个文件）：
```
工程经验总索引（链到 .cursor/rules、postmortems、HANDOFF、小程序专项）：[.agents/ENGINEERING-PLAYBOOK.md](.agents/ENGINEERING-PLAYBOOK.md)
```

**约束**：只加这一行，不删不改现有任何内容。Cursor 读 AGENTS.md 时只多看到一行指针，想深入才点开 PLAYBOOK。

## Assumptions & Decisions

1. **索引不复制正文**：只做指针，避免双源漂移。规则正文仍在各 .mdc / postmortem / HANDOFF，PLAYBOOK 只链 + 一句摘要。**这是防干扰 Cursor 的关键**——若复制 .mdc 内容，未来 .mdc 改了 PLAYBOOK 没同步，Cursor 读 PLAYBOOK 会拿过时规则。
2. **放 `.agents/` 而非 `.trae/`**：三端共用区，Codex/Cursor 也能引用，不偏 Trae。Trae 通过 project_rules.md 引用 PLAYBOOK。
3. **不合并 .cursor/rules 到 .trae/rules**：Cursor 读 .mdc（frontmatter），Trae 读 .md，格式不同。强行合并要么破坏 Cursor frontmatter，要么 Trae 读到无用 frontmatter。保持各自格式，PLAYBOOK 做跨端索引。
4. **不碰 `.cursor/rules/` 任何文件**：Cursor 规则源零改动，干扰风险为零。
5. **AGENTS.md 只加一行**：不展开内容，保持信噪比。
6. **不新建 .trae/rules/engineering-playbook.md**：Trae 每轮注入多个文件可能稀释，不如在现有 project_rules.md 加索引段 + 引用 .agents/PLAYBOOK。集中注入点。
7. **ONBOARDING-TRAE.md 不动**：它是给 Trae 的分工说明，PLAYBOOK 会引用它，不重复内容。
8. **不写部署密码进 PLAYBOOK**：按 AGENTS.md 禁止条款，密码不进仓库。PLAYBOOK 只链 ONBOARDING-TRAE.md 的部署说明（不含密码）。

## Verification

1. `cat .agents/ENGINEERING-PLAYBOOK.md` — 确认 6 大类索引 + 动工前 3 步。
2. `grep -n "工程经验索引" .trae/rules/project_rules.md` — 确认索引段已加。
3. `grep -n "ENGINEERING-PLAYBOOK" AGENTS.md` — 确认 Codex 入口引用。
4. 链接有效性：PLAYBOOK 里每个文件路径 `test -f` 确认存在。
5. 行为验证：下一轮 Trae 动工时，确认我会先读 PLAYBOOK 对应专题再动手（如改语音先读 voice-input-locked + postmortem，改 SP 先读 sp-content-depth）。
